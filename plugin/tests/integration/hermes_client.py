"""Minimal client for a Hermes test instance: cookie login, WebSocket tickets, JSON-RPC on /api/ws."""

from __future__ import annotations

import asyncio
import itertools
import json
import os
from pathlib import Path

import httpx
import websockets

BASE_URL = os.environ.get("HB_TEST_URL", "")
USERNAME = os.environ.get("HB_TEST_USER", "")
PASSWORD_FILE = os.environ.get("HB_TEST_PASSWORD_FILE", "")
WS_URL = BASE_URL.replace("http", "ws", 1)
_ids = itertools.count(1)


def login() -> httpx.Client:
    client = httpx.Client(base_url=BASE_URL, timeout=120)
    password = Path(PASSWORD_FILE).read_text().strip()
    response = client.post("/auth/password-login", json={"provider": "basic", "username": USERNAME, "password": password})
    response.raise_for_status()
    return client


def ticket(client: httpx.Client) -> str:
    response = client.post("/api/auth/ws-ticket")
    response.raise_for_status()
    return response.json()["ticket"]


def event_type(frame: dict):
    if frame.get("method") == "event":
        return (frame.get("params") or {}).get("type")
    return None


class Rpc:
    """One /api/ws connection that answers approvals with ``once`` and keeps every frame."""

    def __init__(self, client: httpx.Client):
        self.client, self.frames, self.pending = client, [], {}

    async def __aenter__(self):
        self.ws = await websockets.connect(f"{WS_URL}/api/ws?ticket={ticket(self.client)}", max_size=None)
        self.reader = asyncio.create_task(self._read())
        await self.wait_event("gateway.ready", 30)
        await self.call("client.capabilities", {"server_requests": True})
        return self

    async def __aexit__(self, *exc):
        self.reader.cancel()
        await self.ws.close()

    async def _read(self):
        async for raw in self.ws:
            frame = json.loads(raw)
            self.frames.append(frame)
            if "id" in frame and "method" not in frame and frame["id"] in self.pending:
                self.pending.pop(frame["id"]).set_result(frame)
            elif "id" in frame and "method" in frame:
                asyncio.create_task(self.reply(frame["id"], {"choice": "once"}))

    async def call(self, method: str, params: dict | None = None, timeout: float = 120):
        request_id = next(_ids)
        future = asyncio.get_running_loop().create_future()
        self.pending[request_id] = future
        await self.ws.send(json.dumps({"jsonrpc": "2.0", "id": request_id, "method": method, "params": params or {}}))
        response = await asyncio.wait_for(future, timeout)
        if "error" in response:
            raise RuntimeError(f"{method}: {response['error']}")
        return response["result"]

    async def reply(self, request_id, result):
        await self.ws.send(json.dumps({"jsonrpc": "2.0", "id": request_id, "result": result}))

    async def wait_event(self, name: str, timeout: float = 120, start: int = 0) -> dict:
        for _ in range(int(timeout * 10)):
            for frame in self.frames[start:]:
                if event_type(frame) == name:
                    return frame
            await asyncio.sleep(0.1)
        raise TimeoutError(name)

    async def turn(self, session_id: str, text: str, timeout: float = 600) -> str:
        """Submit one prompt and return the reply text once it completes."""
        start = len(self.frames)
        await self.call("prompt.submit", {"session_id": session_id, "text": text})
        done = await self.wait_event("message.complete", timeout, start)
        return ((done.get("params") or {}).get("payload") or {}).get("text", "")


class AlertStream:
    """The plugin's alert socket, opened with a fresh ticket."""

    def __init__(self, client: httpx.Client, since: int | None = None):
        self.client, self.since, self.alerts = client, since, []

    async def __aenter__(self):
        self.client.get("/api/plugins/hermes-bots/info").raise_for_status()
        query = f"ticket={ticket(self.client)}" + (f"&since={self.since}" if self.since is not None else "")
        self.ws = await websockets.connect(f"{WS_URL}/api/plugins/hermes-bots/alerts?{query}")
        self.reader = asyncio.create_task(self._read())
        return self

    async def __aexit__(self, *exc):
        self.reader.cancel()
        await self.ws.close()

    async def _read(self):
        async for raw in self.ws:
            message = json.loads(raw)
            if message.get("type") == "alert":
                self.alerts.append(message)

    async def wait_for(self, kind: str, session_id: str, timeout: float = 120) -> dict:
        for _ in range(int(timeout * 10)):
            for alert in self.alerts:
                if alert["kind"] == kind and alert["session_id"] == session_id:
                    return alert
            await asyncio.sleep(0.1)
        raise TimeoutError(f"{kind} alert for {session_id}")

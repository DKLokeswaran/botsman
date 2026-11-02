"""Helpers the integration tests share: chats, their messages, and waiting for routine rows."""

from __future__ import annotations

import os
import time
from pathlib import Path

from hermes_client import Rpc


def profile_home(profile: str) -> Path:
    """The ``HERMES_HOME`` of a profile on the test instance."""
    home = Path(os.environ["HB_TEST_HOME"])
    return home if profile == "default" else home / "profiles" / profile


async def new_chat(client, profile: str) -> str:
    """A stored dashboard chat in ``profile``. Hermes stores a chat at its first turn, so one short turn runs."""
    async with Rpc(client) as rpc:
        result = await rpc.call("session.create", {"profile": profile, "title": "hb-test"})
        await rpc.turn(result["session_id"], "Reply with OK only.")
        return result["stored_session_id"]


def messages(client, profile: str, session_id: str) -> list[dict]:
    response = client.get(f"/api/sessions/{session_id}/messages", params={"profile": profile})
    response.raise_for_status()
    return response.json()["messages"]


def routine_rows(client, profile: str, session_id: str, routine: str) -> list[dict]:
    prefix = f"[Routine: {routine}]\n"
    return [m for m in messages(client, profile, session_id) if (m.get("content") or "").startswith(prefix)]


def wait_for_routine_row(client, profile: str, session_id: str, routine: str, timeout: float = 60) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        rows = routine_rows(client, profile, session_id, routine)
        if rows:
            return rows[-1]
        time.sleep(0.5)
    raise TimeoutError(f"no routine row for {routine!r} in {session_id}")

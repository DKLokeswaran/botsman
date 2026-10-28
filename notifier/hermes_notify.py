#!/usr/bin/env python3
"""Watch a Hermes v0.22.5 gateway and POST a few events to ntfy or UnifiedPush.

One socket does not see every session by itself. See README.md. This process
keeps a single socket, joins each live session, and does not answer approvals.

Standard library only. Credentials come from an env file you create.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import socket
import ssl
import struct
import sys
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import quote, urlparse

WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
SECRET_KEYS = {"HERMES_PASSWORD", "NOTIFY_TOKEN", "HERMES_REFRESH"}


def load_env(path: str) -> dict[str, str]:
    values: dict[str, str] = {}
    with open(path, encoding="utf-8") as handle:
        for raw in handle:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


class Health(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        body = b"ok\n" if self.path == "/health" else b"not found\n"
        status = 200 if self.path == "/health" else 404
        self.send_response(status)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt: str, *args) -> None:
        return


def bind_health(host: str, port: int) -> ThreadingHTTPServer:
    try:
        server = ThreadingHTTPServer((host, port), Health)
    except OSError as exc:
        print(
            f"refusing to start: could not bind {host}:{port} ({exc}). will not fall back to 0.0.0.0",
            file=sys.stderr,
        )
        raise SystemExit(1) from exc
    thread = threading.Thread(target=server.serve_forever, name="notify-health", daemon=True)
    thread.start()
    print(f"health http://{host}:{server.server_address[1]}/health", flush=True)
    return server


def request_json(method: str, url: str, body: dict | None = None, headers: dict | None = None) -> tuple[int, dict, list[str]]:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method)
    for key, value in (headers or {}).items():
        req.add_header(key, value)
    if body is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            cookies = response.headers.get_all("Set-Cookie") or []
            payload = json.loads(response.read().decode("utf-8") or "{}")
            return response.status, payload, cookies
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(raw or "{}")
        except json.JSONDecodeError:
            payload = {}
        return exc.code, payload, []


def cookie_value(cookies: list[str], name: str) -> str:
    for header in cookies:
        pair = header.split(";", 1)[0]
        if pair.startswith(name + "="):
            return pair.split("=", 1)[1]
    return ""


class Gateway:
    def __init__(self, base: str) -> None:
        self.base = base.rstrip("/")
        self.access = ""
        self.refresh = ""
        self.provider = "basic"
        self.username = ""
        self.sock: socket.socket | None = None
        self.next_id = 0
        self.attached: set[str] = set()
        self.dry_run = False
        self.notify_url = ""
        self.notify_token = ""
        self.sent = 0
        self.once = 0

    def login(self, username: str, password: str, provider: str) -> None:
        status, _payload, cookies = request_json(
            "POST",
            f"{self.base}/auth/password-login",
            {"provider": provider, "username": username, "password": password, "next": "/"},
        )
        if status != 200:
            raise RuntimeError(f"login failed ({status})")
        self.access = cookie_value(cookies, "hermes_session_at")
        self.refresh = cookie_value(cookies, "hermes_session_rt")
        self.provider = cookie_value(cookies, "hermes_session_provider") or provider
        self.username = username
        if not self.access or not self.refresh:
            raise RuntimeError("login response had no session cookies")
        print(f"logged in as {username}", flush=True)

    def refresh_session(self) -> None:
        status, payload, _cookies = request_json(
            "POST",
            f"{self.base}/auth/native/refresh",
            {"refresh_token": self.refresh, "provider": self.provider},
        )
        if status != 200:
            raise RuntimeError(f"refresh failed ({status})")
        self.access = str(payload.get("access_token") or "")
        self.refresh = str(payload.get("refresh_token") or "")
        if not self.access or not self.refresh:
            raise RuntimeError("refresh response had no tokens")

    def ticket(self) -> str:
        status, payload, _cookies = request_json(
            "POST",
            f"{self.base}/api/auth/ws-ticket",
            headers={"Authorization": f"Bearer {self.access}"},
        )
        if status == 401 and self.refresh:
            self.refresh_session()
            status, payload, _cookies = request_json(
                "POST",
                f"{self.base}/api/auth/ws-ticket",
                headers={"Authorization": f"Bearer {self.access}"},
            )
        if status != 200:
            raise RuntimeError(f"ticket failed ({status})")
        ticket = str(payload.get("ticket") or "")
        if not ticket:
            raise RuntimeError("empty ticket")
        return ticket

    def connect(self) -> None:
        ticket = self.ticket()
        parsed = urlparse(self.base)
        host = parsed.hostname or "127.0.0.1"
        secure = parsed.scheme == "https"
        port = parsed.port or (443 if secure else 80)
        raw = socket.create_connection((host, port), timeout=20)
        if secure:
            context = ssl.create_default_context()
            raw = context.wrap_socket(raw, server_hostname=host)
        key = base64.b64encode(os.urandom(16)).decode("ascii")
        path = f"/api/ws?ticket={quote(ticket, safe='')}"
        request = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {host}:{port}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n\r\n"
        )
        raw.sendall(request.encode("ascii"))
        raw.settimeout(20)
        header = b""
        while b"\r\n\r\n" not in header:
            chunk = raw.recv(4096)
            if not chunk:
                raise RuntimeError("socket closed during upgrade")
            header += chunk
            if len(header) > 65536:
                raise RuntimeError("upgrade header too large")
        status_line = header.split(b"\r\n", 1)[0].decode("ascii", errors="replace")
        if " 101 " not in status_line:
            raise RuntimeError(f"upgrade rejected: {status_line}")
        raw.settimeout(1)
        self.sock = raw
        self.attached.clear()
        ready = self.read_frame()
        if not ready or ready.get("method") != "event":
            raise RuntimeError("missing gateway.ready")
        self.call("client.capabilities", {"server_requests": True})
        print("socket ready", flush=True)

    def call(self, method: str, params: dict, timeout: float = 20) -> dict:
        self.next_id += 1
        ident = f"n{self.next_id}"
        self.send({"jsonrpc": "2.0", "id": ident, "method": method, "params": params})
        deadline = time.time() + timeout
        while time.time() < deadline:
            frame = self.read_frame(min(1.0, max(0.1, deadline - time.time())))
            if frame is None:
                continue
            if str(frame.get("id")) == ident and "method" not in frame:
                if "error" in frame:
                    raise RuntimeError(f"{method} failed")
                result = frame.get("result")
                return result if isinstance(result, dict) else {}
            self.handle(frame)
        raise RuntimeError(f"{method} timed out")

    def send(self, payload: dict) -> None:
        if self.sock is None:
            raise RuntimeError("not connected")
        data = json.dumps(payload).encode("utf-8")
        header = bytearray([0x81])
        size = len(data)
        mask = os.urandom(4)
        if size < 126:
            header.append(0x80 | size)
        elif size < 65536:
            header.append(0x80 | 126)
            header += struct.pack("!H", size)
        else:
            header.append(0x80 | 127)
            header += struct.pack("!Q", size)
        masked = bytes(byte ^ mask[index % 4] for index, byte in enumerate(data))
        self.sock.sendall(bytes(header) + mask + masked)

    def read_frame(self, timeout: float | None = None) -> dict | None:
        if self.sock is None:
            return None
        if timeout is not None:
            self.sock.settimeout(timeout)
        try:
            header = self._read_exact(2)
        except socket.timeout:
            return None
        if header is None:
            raise RuntimeError("socket closed")
        opcode = header[0] & 0x0F
        masked = (header[1] & 0x80) != 0
        length = header[1] & 0x7F
        if length == 126:
            extra = self._read_exact(2)
            if extra is None:
                raise RuntimeError("socket closed")
            length = struct.unpack("!H", extra)[0]
        elif length == 127:
            extra = self._read_exact(8)
            if extra is None:
                raise RuntimeError("socket closed")
            length = struct.unpack("!Q", extra)[0]
        mask = self._read_exact(4) if masked else b""
        data = self._read_exact(length)
        if data is None or (masked and mask is None):
            raise RuntimeError("socket closed")
        if masked and mask is not None:
            data = bytes(byte ^ mask[index % 4] for index, byte in enumerate(data))
        if opcode == 0x8:
            raise RuntimeError("socket closed by server")
        if opcode == 0x9:
            self._pong(data)
            return self.read_frame(timeout)
        if opcode != 0x1:
            return None
        try:
            parsed = json.loads(data.decode("utf-8"))
        except json.JSONDecodeError:
            return None
        return parsed if isinstance(parsed, dict) else None

    def _read_exact(self, size: int) -> bytes | None:
        if self.sock is None or size == 0:
            return b""
        chunks = []
        remaining = size
        while remaining:
            try:
                chunk = self.sock.recv(remaining)
            except socket.timeout:
                if chunks:
                    continue
                raise
            if not chunk:
                return None
            chunks.append(chunk)
            remaining -= len(chunk)
        return b"".join(chunks)

    def _pong(self, data: bytes) -> None:
        if self.sock is None:
            return
        header = bytearray([0x8A, 0x80 | len(data)])
        mask = os.urandom(4)
        masked = bytes(byte ^ mask[index % 4] for index, byte in enumerate(data))
        try:
            self.sock.sendall(bytes(header) + mask + masked)
        except OSError:
            return

    def handle(self, frame: dict) -> None:
        method = frame.get("method")
        if method == "event":
            params = frame.get("params") if isinstance(frame.get("params"), dict) else {}
            self.on_event(str(params.get("type") or ""), params)
            return
        if isinstance(method, str) and "id" in frame:
            params = frame.get("params") if isinstance(frame.get("params"), dict) else {}
            if method == "approval":
                self.emit("approval", "Approval waiting", str(params.get("description") or params.get("command") or "Approval"))
            elif method == "clarify":
                questions = params.get("questions") if isinstance(params.get("questions"), list) else []
                first = questions[0].get("question") if questions and isinstance(questions[0], dict) else "Question"
                self.emit("clarify", "Question waiting", str(first))
            return

    def on_event(self, event_type: str, params: dict) -> None:
        payload = params.get("payload") if isinstance(params.get("payload"), dict) else {}
        if event_type == "message.complete":
            status = str(payload.get("status") or "")
            text = str(payload.get("text") or "")
            if status == "error" or payload.get("error"):
                self.emit("error", "Hermes error", str(payload.get("error") or text or "Reply failed")[:240])
            elif text or status == "complete":
                self.emit("reply", "Reply finished", (text or "Reply finished")[:240])
        elif event_type == "error":
            self.emit("error", "Hermes error", str(payload.get("message") or payload.get("text") or "Error")[:240])

    def emit(self, kind: str, title: str, body: str) -> None:
        record = {"kind": kind, "title": title, "body": body}
        print("NOTIFY " + json.dumps(record, ensure_ascii=False), flush=True)
        self.sent += 1
        if not self.dry_run and self.notify_url:
            data = body.encode("utf-8")
            req = urllib.request.Request(self.notify_url, data=data, method="POST")
            req.add_header("Title", title)
            req.add_header("Content-Type", "text/plain")
            req.add_header("Tags", kind)
            if self.notify_token:
                req.add_header("Authorization", f"Bearer {self.notify_token}")
            try:
                with urllib.request.urlopen(req, timeout=15) as response:
                    response.read()
            except Exception as exc:  # noqa: BLE001 — delivery must not kill the watcher
                print(f"notify post failed ({type(exc).__name__})", file=sys.stderr, flush=True)
        if self.once and self.sent >= self.once:
            raise SystemExit(0)

    def poll(self) -> None:
        result = self.call("session.active_list", {})
        rows = result.get("sessions") if isinstance(result.get("sessions"), list) else []
        for row in rows:
            if not isinstance(row, dict):
                continue
            sid = str(row.get("id") or "")
            if not sid or sid in self.attached:
                continue
            self.call("session.activate", {"session_id": sid, "omit_messages": True})
            self.attached.add(sid)

    def close(self) -> None:
        if self.sock is not None:
            try:
                self.sock.close()
            except OSError:
                pass
            self.sock = None


def main() -> None:
    parser = argparse.ArgumentParser(description="Forward Hermes approvals and finished replies to ntfy")
    parser.add_argument("--env-file", default="notifier.env")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--bind")
    parser.add_argument("--port", type=int)
    parser.add_argument("--poll-seconds", type=float)
    parser.add_argument("--once-events", type=int, default=0)
    args = parser.parse_args()
    env = load_env(args.env_file)
    host = args.bind or env.get("BIND_HOST") or ""
    if not host:
        print("BIND_HOST is required. Refusing to listen on every interface.", file=sys.stderr)
        raise SystemExit(1)
    port = args.port if args.port is not None else int(env.get("BIND_PORT") or "9191")
    bind_health(host, port)
    gateway = Gateway(env.get("HERMES_URL") or "")
    if not gateway.base:
        print("HERMES_URL is required", file=sys.stderr)
        raise SystemExit(1)
    gateway.dry_run = args.dry_run
    gateway.notify_url = env.get("NOTIFY_URL") or ""
    gateway.notify_token = env.get("NOTIFY_TOKEN") or ""
    gateway.once = args.once_events
    username = env.get("HERMES_USERNAME") or ""
    password = env.get("HERMES_PASSWORD") or ""
    provider = env.get("HERMES_PROVIDER") or "basic"
    if not username or not password:
        print("HERMES_USERNAME and HERMES_PASSWORD are required", file=sys.stderr)
        raise SystemExit(1)
    poll_seconds = args.poll_seconds if args.poll_seconds is not None else float(env.get("POLL_SECONDS") or "5")
    backoff = 1.0
    while True:
        try:
            if not gateway.access:
                gateway.login(username, password, provider)
            gateway.connect()
            backoff = 1.0
            last_poll = 0.0
            last_ping = time.time()
            gateway.poll()
            last_poll = time.time()
            while True:
                frame = gateway.read_frame(1)
                now = time.time()
                if frame is not None:
                    gateway.handle(frame)
                if now - last_poll >= poll_seconds:
                    gateway.poll()
                    last_poll = now
                if now - last_ping >= 15:
                    gateway.call("gateway.ping", {})
                    last_ping = now
        except SystemExit:
            raise
        except Exception as exc:  # noqa: BLE001
            print(f"reconnecting ({type(exc).__name__})", file=sys.stderr, flush=True)
            gateway.close()
            gateway.access = ""
            time.sleep(backoff)
            backoff = min(backoff * 2, 30)


if __name__ == "__main__":
    main()

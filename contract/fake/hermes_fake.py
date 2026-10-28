#!/usr/bin/env python3
"""In-process stand-in for the Hermes v0.22.5 gateway the thin clients speak.

The login is fake and exists only inside this process: username ``tester``,
password ``tester``. Nothing here is a real Hermes credential.

Shapes follow the pinned contract and the v0.22.5 handlers:

- ``POST /auth/password-login`` sets ``hermes_session_at`` / ``hermes_session_rt``
  cookies and returns ``{"ok": true}``. Tokens are not in the JSON body.
- ``POST /api/auth/ws-ticket`` returns a 30-second single-use ticket.
- ``POST /auth/native/refresh`` rotates a refresh token into a bearer body.
- ``GET /api/ws?ticket=`` speaks JSON-RPC. ``gateway.ready`` is the first frame.
  ``gateway.ping`` is answered even though it is not an OpenRPC method.
- ``session.events.since`` returns event ``params`` objects plus ``open_requests``.

``HERMES_FAKE_TEST_HOOKS=1`` exposes loopback controls for the Windows browser
suite (reset, a scripted reply, an extra session, and a state readout). It also
repeats ``Set-Cookie`` in ``X-E2E-Set-Cookie`` and answers CORS preflight.
Leave the variable unset and those paths 404; login and JSON-RPC stay as below.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import secrets
import struct
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
FAKE_USER = "tester"
FAKE_PASSWORD = "tester"
EPOCH = "epoch-phase0"
SESSION_STORED = "sess-1"
SESSION_LIVE = "live-1"


class State:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.access: dict[str, dict] = {}
        self.refresh: dict[str, dict] = {}
        self.tickets: dict[str, dict] = {}
        self.events: list[dict] = []
        self.next_seq = 0
        self.open_requests: dict[str, dict] = {}
        self.approval_sent = False
        self.activated = False
        self.answers: list[dict] = []
        self.sockets: list = []
        self.attached: dict = {}
        self.next_row = 2
        self.next_session = 2
        self.scripted_reply: str | None = None
        self.sessions: dict[str, dict] = _hello_sessions()

    def reset(self) -> None:
        with self.lock:
            self.access.clear()
            self.refresh.clear()
            self.tickets.clear()
            self.events.clear()
            self.next_seq = 0
            self.open_requests.clear()
            self.approval_sent = False
            self.activated = False
            self.answers.clear()
            self.sockets.clear()
            self.attached.clear()
            self.next_row = 2
            self.next_session = 2
            self.scripted_reply = None
            self.sessions = _hello_sessions()

    def lookup(self, session_id: str | None) -> dict:
        if session_id and session_id in self.sessions:
            return self.sessions[session_id]
        if session_id:
            for record in self.sessions.values():
                if record["stored"] == session_id:
                    return record
        return self.sessions[SESSION_LIVE]

    def mint_session(self, username: str) -> tuple[str, str]:
        access = "at." + secrets.token_urlsafe(18)
        refresh = "rt." + secrets.token_urlsafe(18)
        now = int(time.time())
        with self.lock:
            self.access[access] = {"username": username, "exp": now + 12 * 3600}
            self.refresh[refresh] = {"username": username, "exp": now + 30 * 24 * 3600}
        return access, refresh

    def rotate(self, refresh: str) -> dict | None:
        with self.lock:
            row = self.refresh.pop(refresh, None)
        if row is None or row["exp"] < time.time():
            return None
        access, new_refresh = self.mint_session(row["username"])
        return {
            "access_token": access,
            "refresh_token": new_refresh,
            "token_type": "Bearer",
            "expires_at": int(time.time()) + 12 * 3600,
            "provider": "basic",
            "user_id": row["username"],
        }

    def take_ticket(self, ticket: str) -> bool:
        with self.lock:
            row = self.tickets.get(ticket)
            if row is None or row["used"] or row["exp"] < time.time():
                return False
            row["used"] = True
            return True

    def stamp(self, event_type: str, payload: dict, session_id: str = SESSION_LIVE) -> dict:
        with self.lock:
            self.next_seq += 1
            params = {
                "type": event_type,
                "session_id": session_id,
                "payload": payload,
                "seq": self.next_seq,
            }
            self.events.append(params)
            return params

    def since(self, last_seen: int) -> dict:
        with self.lock:
            frames = [dict(item) for item in self.events if item["seq"] > last_seen]
            latest = self.next_seq
            open_requests = [dict(item) for item in self.open_requests.values()]
        return {
            "events": frames,
            "latest_seq": latest,
            "truncated": False,
            "count": len(frames),
            "epoch": EPOCH,
            "open_requests": open_requests,
        }


def _hello_sessions() -> dict[str, dict]:
    return {
        SESSION_LIVE: {
            "stored": SESSION_STORED,
            "live": SESSION_LIVE,
            "title": "Hello",
            "messages": [{"role": "user", "text": "Say hello", "row_id": 1}],
        }
    }


STATE = State()
WRITE_LOCK = threading.Lock()
TEST_HOOKS = os.environ.get("HERMES_FAKE_TEST_HOOKS") == "1"


def _json_bytes(payload: dict) -> bytes:
    return json.dumps(payload).encode("utf-8")


def _read_frame(rfile) -> tuple[int, bytes] | None:
    header = rfile.read(2)
    if len(header) < 2:
        return None
    opcode = header[0] & 0x0F
    masked = (header[1] & 0x80) != 0
    length = header[1] & 0x7F
    if length == 126:
        length = struct.unpack("!H", rfile.read(2))[0]
    elif length == 127:
        length = struct.unpack("!Q", rfile.read(8))[0]
    mask = rfile.read(4) if masked else b""
    data = rfile.read(length)
    if len(data) < length:
        return None
    if masked:
        data = bytes(byte ^ mask[index % 4] for index, byte in enumerate(data))
    return opcode, data


def _write_frame(wfile, opcode: int, data: bytes) -> None:
    header = bytearray([0x80 | opcode])
    size = len(data)
    if size < 126:
        header.append(size)
    elif size < 65536:
        header.append(126)
        header += struct.pack("!H", size)
    else:
        header.append(127)
        header += struct.pack("!Q", size)
    try:
        with WRITE_LOCK:
            wfile.write(bytes(header) + data)
            wfile.flush()
    except (BrokenPipeError, ConnectionResetError, OSError):
        return


def _send_json(wfile, payload: dict) -> None:
    _write_frame(wfile, 1, _json_bytes(payload))


def _event_frame(params: dict) -> dict:
    return {"jsonrpc": "2.0", "method": "event", "params": params}


def _ok(rid, result: dict) -> dict:
    return {"jsonrpc": "2.0", "id": rid, "result": result}


def _err(rid, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": rid, "error": {"code": code, "message": message}}


def _bearer(header: str | None) -> str:
    if not header:
        return ""
    parts = header.split(" ", 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return ""


def _cookie(header: str | None, name: str) -> str:
    if not header:
        return ""
    for part in header.split(";"):
        piece = part.strip()
        if piece.startswith(name + "="):
            return piece.split("=", 1)[1]
    return ""


def _auth_user(handler: BaseHTTPRequestHandler) -> str | None:
    token = _bearer(handler.headers.get("Authorization"))
    if not token:
        token = _cookie(handler.headers.get("Cookie"), "hermes_session_at")
    with STATE.lock:
        row = STATE.access.get(token)
    if row is None or row["exp"] < time.time():
        return None
    return row["username"]


PROFILES = {
    "profiles": [
        {
            "name": "default",
            "path": "/tmp/hermes/default",
            "is_default": True,
            "model": "fake-model",
            "provider": "fake",
            "description": "Main profile",
            "display_name": "Junior",
            "skill_count": 0,
            "has_avatar": False,
        }
    ],
    "bot_mode_protocol": True,
    "install_id": "fake",
}

def _session_list() -> dict:
    with STATE.lock:
        rows = []
        for record in STATE.sessions.values():
            messages = record["messages"]
            preview = messages[-1]["text"] if messages else ""
            rows.append(
                {
                    "id": record["stored"],
                    "title": record["title"],
                    "preview": preview,
                    "started_at": 1,
                    "message_count": len(messages),
                    "source": "phase0",
                }
            )
    return {"sessions": rows}


def _history(session_id: str | None) -> dict:
    with STATE.lock:
        record = STATE.lookup(session_id)
        messages = [dict(item) for item in record["messages"]]
    return {"count": len(messages), "messages": messages}


def _attach(wfile, session_id: str) -> None:
    with STATE.lock:
        STATE.attached.setdefault(wfile, set()).add(session_id)


def _targets(session_id: str | None) -> list:
    with STATE.lock:
        if session_id:
            return [sock for sock, sessions in STATE.attached.items() if session_id in sessions]
        return list(STATE.sockets)


def _broadcast(params: dict, session_id: str | None) -> None:
    frame = _event_frame(params)
    for sock in _targets(session_id):
        _send_json(sock, frame)


def _emit_changed() -> None:
    _broadcast(STATE.stamp("sessions.changed", {}, ""), None)


def _append_message(session_id: str, role: str, text: str) -> None:
    with STATE.lock:
        record = STATE.lookup(session_id)
        record["messages"].append({"role": role, "text": text, "row_id": STATE.next_row})
        STATE.next_row += 1


def _detach(wfile) -> None:
    with STATE.lock:
        STATE.attached.pop(wfile, None)
        try:
            STATE.sockets.remove(wfile)
        except ValueError:
            pass


def _approval_params() -> dict:
    return {
        "session_id": SESSION_LIVE,
        "request_id": "req-1",
        "command": "git status",
        "description": "Read the repo status",
        "choices": ["once", "deny"],
        "tool_name": "terminal",
    }


def _ensure_approval() -> None:
    with STATE.lock:
        if STATE.approval_sent:
            return
        STATE.approval_sent = True
        frame = {
            "id": "srq-phase0",
            "method": "approval",
            "params": _approval_params(),
        }
        STATE.open_requests[frame["id"]] = frame


def _push_open_requests(wfile) -> None:
    with STATE.lock:
        frames = [dict(item) for item in STATE.open_requests.values()]
    for approval in frames:
        _send_json(
            wfile,
            {
                "jsonrpc": "2.0",
                "id": approval["id"],
                "method": approval["method"],
                "params": approval["params"],
            },
        )


def _find_open(rpc_id: str | None, request_id: str | None) -> dict | None:
    if rpc_id:
        return STATE.open_requests.get(rpc_id)
    if request_id:
        for item in STATE.open_requests.values():
            if str(item["params"].get("request_id")) == str(request_id):
                return item
        return None
    if not STATE.open_requests:
        return None
    return next(iter(STATE.open_requests.values()))


def _settle_approval(rpc_id: str | None, request_id: str | None, choice) -> int:
    """Pop the open approval. request.cancel carries a reason and no choice."""
    with STATE.lock:
        match = _find_open(rpc_id, request_id)
        if match is None:
            return 0
        STATE.open_requests.pop(match["id"], None)
        session_id = str(match["params"].get("session_id") or SESSION_LIVE)
        STATE.answers.append({"id": match["id"], "choice": choice, "request_id": match["params"].get("request_id")})
    params = STATE.stamp(
        "request.cancel",
        {"id": match["id"], "method": match["method"], "reason": "resolved"},
        session_id,
    )
    _broadcast(params, session_id)
    if choice == "deny":
        result = "BLOCKED: command denied by user"
    elif choice in ("once", "session", "always"):
        result = "ok"
    else:
        result = None
    if result is not None:
        done = STATE.stamp(
            "tool.complete",
            {"tool_id": "tool-1", "name": str(match["params"].get("tool_name") or "terminal"), "result": result, "result_text": result},
            session_id,
        )
        _broadcast(done, session_id)
    return 1


def _cancel_session_approvals(session_id: str) -> None:
    """Interrupt/teardown: approval.cancelled is broadcast, and each card is withdrawn."""
    with STATE.lock:
        record = STATE.lookup(session_id)
        live = record["live"]
        stored = record["stored"]
        dropped = [
            item
            for item in STATE.open_requests.values()
            if str(item["params"].get("session_id") or live) in (live, stored)
        ]
        for item in dropped:
            STATE.open_requests.pop(item["id"], None)
        request_ids: list[str] = []
        for item in dropped:
            request_ids.append(str(item["id"]))
            approval_id = item["params"].get("request_id")
            if approval_id:
                request_ids.append(str(approval_id))
    for item in dropped:
        sid = str(item["params"].get("session_id") or live)
        _broadcast(
            STATE.stamp(
                "request.cancel",
                {"id": item["id"], "method": item["method"], "reason": "interrupted"},
                sid,
            ),
            sid,
        )
    _broadcast(
        STATE.stamp(
            "approval.cancelled",
            {
                "session_id": live,
                "stored_session_id": stored,
                "reason": "interrupted",
                "cancelled_count": len(dropped),
                "request_ids": request_ids,
            },
            live,
        ),
        None,
    )


def _test_state() -> dict:
    with STATE.lock:
        open_requests = [dict(item) for item in STATE.open_requests.values()]
        sessions = []
        extras = []
        history: list[dict] = []
        for record in STATE.sessions.values():
            messages = [dict(item) for item in record["messages"]]
            if record["live"] == SESSION_LIVE:
                history = messages
            sessions.append(
                {
                    "id": record["stored"],
                    "live_id": record["live"],
                    "title": record["title"],
                    "preview": messages[-1]["text"] if messages else "",
                    "started_at": 1,
                    "message_count": len(messages),
                    "source": "phase0",
                }
            )
            if record["stored"] != SESSION_STORED:
                extras.append(
                    {
                        "id": record["stored"],
                        "title": record["title"],
                        "marker": messages[0]["text"] if messages else "",
                    }
                )
    return {
        "open_requests": open_requests,
        "history": history,
        "profiles": [dict(item) for item in PROFILES["profiles"]],
        "sessions": sessions,
        "extras": extras,
    }


def _install_scripted_session(session_id: str, title: str, marker: str) -> None:
    """Store an extra session the stock list does not have. Resume attaches it like any other."""
    with STATE.lock:
        for key, record in list(STATE.sessions.items()):
            if key == session_id or record["stored"] == session_id or record["live"] == session_id:
                STATE.sessions.pop(key, None)
        number = STATE.next_session
        STATE.next_session += 1
        live = f"live-{number}"
        STATE.sessions[live] = {
            "stored": session_id,
            "live": live,
            "title": title,
            "messages": [{"role": "user", "text": marker, "row_id": STATE.next_row}],
        }
        STATE.next_row += 1
    _emit_changed()


def _handle_test_hook(handler: "Handler", path: str, incoming: dict) -> None:
    if path == "/__test__/reset":
        STATE.reset()
        handler._json_response(200, {"ok": True})
        return
    if path == "/__test__/reply":
        text = incoming.get("text")
        if not isinstance(text, str):
            handler._json_response(400, {"error": "text must be a string"})
            return
        with STATE.lock:
            STATE.scripted_reply = text
        handler._json_response(200, {"ok": True})
        return
    if path == "/__test__/session":
        session_id = str(incoming.get("id") or "")
        title = str(incoming.get("title") or session_id)
        marker = str(incoming.get("marker") or title)
        if not session_id:
            handler._json_response(400, {"error": "id is required"})
            return
        _install_scripted_session(session_id, title, marker)
        handler._json_response(200, {"ok": True})
        return
    handler._json_response(404, {"error": "not found"})


def _dispatch(wfile, req: dict) -> None:
    rid = req.get("id")
    method = req.get("method")
    params = req.get("params") or {}
    if method == "gateway.ping":
        _send_json(wfile, _ok(rid, {"ok": True}))
        return
    if method == "ping":
        _send_json(wfile, _ok(rid, {"pong": True}))
        return
    if method == "client.capabilities":
        _send_json(
            wfile,
            _ok(rid, {"server_requests": ["approval", "clarify"], "declines_not_shown": True}),
        )
        if params.get("server_requests"):
            _ensure_approval()
            _push_open_requests(wfile)
        return
    if method == "profiles.list":
        _send_json(wfile, _ok(rid, PROFILES))
        return
    if method == "session.list":
        _send_json(wfile, _ok(rid, _session_list()))
        return
    if method == "session.active_list":
        _send_json(
            wfile,
            _ok(
                rid,
                {
                    "sessions": [
                        {
                            "current": False,
                            "id": SESSION_LIVE,
                            "last_active": 1,
                            "message_count": 1,
                            "model": "fake-model",
                            "preview": "Say hello",
                            "profile": "default",
                        }
                    ]
                },
            ),
        )
        return
    if method == "session.create":
        with STATE.lock:
            number = STATE.next_session
            STATE.next_session += 1
            live = f"live-{number}"
            stored = f"sess-{number}"
            STATE.sessions[live] = {
                "stored": stored,
                "live": live,
                "title": "New",
                "messages": [],
            }
        _emit_changed()
        _send_json(
            wfile,
            _ok(
                rid,
                {
                    "session_id": live,
                    "stored_session_id": stored,
                    "message_count": 0,
                    "messages": [],
                    "info": {"title": "New", "model": "fake-model", "running": False},
                },
            ),
        )
        return
    if method == "session.interrupt":
        _cancel_session_approvals(str(params.get("session_id") or SESSION_LIVE))
        _send_json(wfile, _ok(rid, {"interrupted": True}))
        return
    if method in ("session.resume", "session.activate"):
        with STATE.lock:
            record = STATE.lookup(str(params.get("session_id") or "") or None)
            live = record["live"]
            messages = [dict(item) for item in record["messages"]]
            title = record["title"]
            open_requests = [
                dict(item)
                for item in STATE.open_requests.values()
                if str(item["params"].get("session_id") or live) in (live, record["stored"])
            ]
            # The notifier resumes with omit_messages and does not render a transcript.
            # The first such attach, like the first session.activate, still delivers one
            # finished reply so a watcher can see a session event. App resumes do not.
            watching = method == "session.activate" or bool(params.get("omit_messages"))
            first_activate = watching and not STATE.activated
            if watching:
                STATE.activated = True
        _attach(wfile, live)
        _send_json(
            wfile,
            _ok(
                rid,
                {
                    "session_id": live,
                    "messages": messages,
                    "info": {"title": title, "model": "fake-model", "running": False},
                    "open_requests": open_requests,
                },
            ),
        )
        if first_activate:
            params_done = STATE.stamp(
                "message.complete",
                {"text": "Finished while you were away", "status": "complete"},
                live,
            )
            _broadcast(params_done, live)
        return
    if method == "session.history":
        _send_json(wfile, _ok(rid, _history(str(params.get("session_id") or "") or None)))
        return
    if method == "session.events.since":
        try:
            last_seen = int(params.get("last_seen", 0))
        except (TypeError, ValueError):
            _send_json(wfile, _err(rid, -32602, "invalid params: last_seen must be an integer"))
            return
        _send_json(wfile, _ok(rid, STATE.since(last_seen)))
        return
    if method == "prompt.submit":
        session_id = str(params.get("session_id") or SESSION_LIVE)
        text = str(params.get("text") or "")
        _send_json(wfile, _ok(rid, {"status": "streaming"}))
        _append_message(session_id, "user", text)
        _emit_changed()
        with STATE.lock:
            live = STATE.lookup(session_id)["live"]
            delta = "Hello"
            done = "Hello from Hermes"
            if TEST_HOOKS and STATE.scripted_reply is not None:
                delta = STATE.scripted_reply
                done = STATE.scripted_reply
                STATE.scripted_reply = None
        for event_type, payload in (
            ("message.start", {}),
            ("message.delta", {"text": delta}),
            ("message.complete", {"text": done, "status": "complete"}),
        ):
            _broadcast(STATE.stamp(event_type, payload, live), live)
        _append_message(live, "assistant", done)
        _emit_changed()
        return
    if method == "approval.received":
        _send_json(wfile, _ok(rid, {"acknowledged": True}))
        return
    if method == "approval.respond":
        request_id = params.get("request_id")
        count = _settle_approval(
            None,
            str(request_id) if request_id else None,
            params.get("choice"),
        )
        _send_json(wfile, _ok(rid, {"resolved": count}))
        return
    if method == "approval.pending":
        with STATE.lock:
            approvals = [
                {
                    "request_id": item["params"].get("request_id"),
                    "command": item["params"].get("command"),
                    "description": item["params"].get("description"),
                }
                for item in STATE.open_requests.values()
                if item["method"] == "approval"
            ]
        _send_json(wfile, _ok(rid, {"approvals": approvals}))
        return
    _send_json(wfile, _err(rid, -32601, f"method not found: {method}"))


def _handle_socket(handler: BaseHTTPRequestHandler, ticket: str) -> None:
    if not STATE.take_ticket(ticket):
        body = b'{"error":"invalid ticket"}'
        handler.send_response(401)
        handler.send_header("Content-Type", "application/json")
        handler.send_header("Content-Length", str(len(body)))
        handler.end_headers()
        handler.wfile.write(body)
        return
    key = handler.headers.get("Sec-WebSocket-Key", "")
    accept = base64.b64encode(hashlib.sha1((key + WS_GUID).encode("ascii")).digest()).decode("ascii")
    handler.send_response(101, "Switching Protocols")
    handler.send_header("Upgrade", "websocket")
    handler.send_header("Connection", "Upgrade")
    handler.send_header("Sec-WebSocket-Accept", accept)
    handler.end_headers()
    _send_json(
        handler.wfile,
        _event_frame(
            {
                "type": "gateway.ready",
                "payload": {
                    "skin": {},
                    "change_events": True,
                    "heartbeat": True,
                    "replay_epoch": EPOCH,
                },
            }
        ),
    )
    with STATE.lock:
        STATE.sockets.append(handler.wfile)
    try:
        while True:
            frame = _read_frame(handler.rfile)
            if frame is None:
                return
            opcode, data = frame
            if opcode == 0x8:
                _write_frame(handler.wfile, 0x8, data[:2])
                return
            if opcode == 0x9:
                _write_frame(handler.wfile, 0xA, data)
                continue
            if opcode != 0x1:
                continue
            try:
                message = json.loads(data.decode("utf-8"))
            except json.JSONDecodeError:
                _send_json(handler.wfile, _err(None, -32700, "parse error"))
                continue
            if isinstance(message, dict) and "method" not in message and "id" in message:
                result = message.get("result") if isinstance(message.get("result"), dict) else {}
                choice = result.get("choice") if isinstance(result, dict) else None
                _settle_approval(str(message["id"]), None, choice)
                continue
            if isinstance(message, dict) and message.get("method"):
                _dispatch(handler.wfile, message)
    finally:
        _detach(handler.wfile)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args) -> None:
        # Method and path only. Query strings can carry a ticket.
        path = urlparse(self.path).path
        print(f"fake {self.command} {path}", file=__import__("sys").stderr, flush=True)

    def _body(self) -> bytes:
        length = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(length) if length else b""

    def _json_response(self, status: int, payload: dict, cookies: list[str] | None = None) -> None:
        raw = _json_bytes(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        for cookie in cookies or []:
            self.send_header("Set-Cookie", cookie)
        if TEST_HOOKS:
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "content-type, authorization, accept")
            self.send_header("Access-Control-Expose-Headers", "X-E2E-Set-Cookie")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            if cookies:
                encoded = base64.b64encode(json.dumps(cookies).encode("utf-8")).decode("ascii")
                self.send_header("X-E2E-Set-Cookie", encoded)
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self) -> None:  # noqa: N802
        if not TEST_HOOKS:
            self.send_error(501, "Unsupported method ('OPTIONS')")
            return
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "content-type, authorization, accept")
        self.send_header("Access-Control-Expose-Headers", "X-E2E-Set-Cookie")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if TEST_HOOKS and parsed.path == "/__test__/state":
            self._json_response(200, _test_state())
            return
        if parsed.path == "/api/health":
            self._json_response(200, {"ok": True})
            return
        if parsed.path == "/api/ws":
            ticket = parse_qs(parsed.query).get("ticket", [""])[0]
            _handle_socket(self, ticket)
            return
        self._json_response(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        try:
            incoming = json.loads(self._body().decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._json_response(400, {"error": "bad json"})
            return
        if TEST_HOOKS and parsed.path.startswith("/__test__/"):
            _handle_test_hook(self, parsed.path, incoming if isinstance(incoming, dict) else {})
            return
        if parsed.path == "/auth/password-login":
            # Exact, case-sensitive match. Spaces are part of the credential.
            # Real Hermes rejects these as invalid_credentials, not a later 401.
            username = incoming.get("username") if isinstance(incoming, dict) else None
            password = incoming.get("password") if isinstance(incoming, dict) else None
            if (
                not isinstance(username, str)
                or not isinstance(password, str)
                or username != FAKE_USER
                or password != FAKE_PASSWORD
            ):
                self._json_response(
                    401,
                    {"detail": "Invalid credentials", "reason": "invalid_credentials"},
                )
                return
            access, refresh = STATE.mint_session(username)
            self._json_response(
                200,
                {"ok": True, "next": "/"},
                cookies=[
                    f"hermes_session_at={access}; HttpOnly; Path=/; SameSite=Lax",
                    f"hermes_session_rt={refresh}; HttpOnly; Path=/; SameSite=Lax",
                    "hermes_session_provider=basic; HttpOnly; Path=/; SameSite=Lax",
                ],
            )
            return
        if parsed.path == "/api/auth/ws-ticket":
            if _auth_user(self) is None:
                self._json_response(401, {"error": "Unauthorized"})
                return
            ticket = secrets.token_urlsafe(24)
            with STATE.lock:
                STATE.tickets[ticket] = {"exp": time.time() + 30, "used": False}
            self._json_response(200, {"ticket": ticket, "ttl_seconds": 30})
            return
        if parsed.path == "/auth/native/refresh":
            rotated = STATE.rotate(str(incoming.get("refresh_token") or ""))
            if rotated is None:
                self._json_response(401, {"detail": "Session expired"})
                return
            self._json_response(200, rotated)
            return
        self._json_response(404, {"error": "not found"})


def serve(host: str, port: int) -> ThreadingHTTPServer:
    server = ThreadingHTTPServer((host, port), Handler)
    thread = threading.Thread(target=server.serve_forever, name="hermes-fake", daemon=True)
    thread.start()
    return server


def main() -> None:
    parser = argparse.ArgumentParser(description="Fake Hermes gateway for Phase 0 tests")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=0)
    args = parser.parse_args()
    server = serve(args.host, args.port)
    print(f"LISTENING {server.server_address[1]}", flush=True)
    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        server.shutdown()


if __name__ == "__main__":
    main()

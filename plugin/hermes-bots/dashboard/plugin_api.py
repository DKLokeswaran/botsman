"""Dashboard routes: ``GET /info`` and the ``/alerts`` WebSocket.

Mounted under ``/api/plugins/hermes-bots/``. Only the launch profile's copy can serve the socket,
and it streams alerts for every bot from the shared store. Hermes does not check logins on plugin
WebSocket routes, so the socket runs the same checks as ``/api/ws``: chat switched on, credentials,
and Host/Origin.
"""

from __future__ import annotations

import asyncio
import importlib.util
import json
import sys
import time
from pathlib import Path

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

POLL_S = 0.5
PING_EVERY_S = 20.0
_PLUGIN_DIR = Path(__file__).resolve().parent.parent


def _load_sibling(name: str):
    """Load a module from the plugin root by path; the plugin package itself is not importable here."""
    module_name = f"hermes_bots_dashboard_{name}"
    if module_name in sys.modules:
        return sys.modules[module_name]
    spec = importlib.util.spec_from_file_location(module_name, _PLUGIN_DIR / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


store = _load_sibling("store")
version = _load_sibling("version")
router = APIRouter()


@router.get("/info")
async def info() -> dict:
    """The plugin code this dashboard is running, and where the alert stream stands."""
    return {
        "plugin": "hermes-bots",
        "version": version.VERSION,
        "store_schema": store.SCHEMA_VERSION,
        "store_id": await asyncio.to_thread(store.store_id),
        "latest_alert_id": await asyncio.to_thread(store.latest_alert_id),
    }


def _connection_allowed(ws: WebSocket) -> bool:
    """The same checks that ``/api/ws`` runs: chat switched on, a valid login and an allowed Host/Origin."""
    from hermes_cli import web_server
    from hermes_cli.dashboard_auth.native_http import HEADER
    from hermes_cli.web_server_chat import _ws_auth_ok, _ws_request_is_allowed
    # /api/ws refuses everything while chat is off, and refuses the Desktop app's native sign-in header
    if not getattr(web_server, "_DASHBOARD_EMBEDDED_CHAT_ENABLED", False) or HEADER in ws.headers:
        return False
    return _ws_auth_ok(ws) and _ws_request_is_allowed(ws)


def _start_id(raw: str | None) -> int | None:
    """``since`` from the query; None when absent, so the stream starts after the newest alert."""
    if raw is None or raw == "":
        return None
    return max(0, int(raw))


@router.websocket("/alerts")
async def alerts(ws: WebSocket) -> None:
    """Stream alerts to an app, after the same checks as ``/api/ws``."""
    # Refuse a connection without a valid ticket or from a disallowed Origin
    if not _connection_allowed(ws):
        await ws.close(code=1008)
        return
    # Refuse a malformed ``since``
    try:
        since = _start_id(ws.query_params.get("since"))
    except ValueError:
        await ws.close(code=1008)
        return
    # Accept, echoing the subprotocol the ticket came in, and stream from the starting alert
    await ws.accept(subprotocol=getattr(ws, "_hermes_ws_subprotocol", None))
    stream_store, last_id = await asyncio.to_thread(_stream_start, since)
    try:
        await _stream(ws, stream_store, last_id)
    except (WebSocketDisconnect, RuntimeError):
        return


def _stream_start(since: int | None) -> tuple[str, int]:
    """The store the stream reads and the alert id it starts after.

    Without ``since`` that is the newest alert. A ``since`` above the newest alert means the store was
    recreated since the client last connected, so the stream replays every alert from the start.
    """
    stream_store, latest = store.store_id(), store.latest_alert_id()
    if since is None:
        return stream_store, latest
    return stream_store, (since if since <= latest else 0)


async def _stream(ws: WebSocket, stream_store: str, last_id: int) -> None:
    """Send every alert after ``last_id`` as it arrives, with a ping when the stream is quiet.

    When the store is recreated during the stream, a ping with the new ``store_id`` comes first,
    then the new store's alerts from the start.
    """
    last_sent = time.monotonic()
    while True:
        # Start over on a recreated store, announcing its id before any of its alerts
        current_store = await asyncio.to_thread(store.store_id)
        if current_store != stream_store:
            stream_store, last_id = current_store, 0
            last_sent = await _send_ping(ws, last_id, stream_store)
        # Send alerts raised since the last poll
        for row in await asyncio.to_thread(store.alerts_after, last_id):
            await ws.send_text(json.dumps({"type": "alert", **row}))
            last_id, last_sent = row["id"], time.monotonic()
        # Ping when nothing was sent for a while
        if time.monotonic() - last_sent >= PING_EVERY_S:
            last_sent = await _send_ping(ws, last_id, stream_store)
        await asyncio.sleep(POLL_S)


async def _send_ping(ws: WebSocket, last_id: int, store_id: str) -> float:
    """Send a ping; returns when it was sent."""
    await ws.send_text(json.dumps({"type": "ping", "latest_alert_id": last_id, "store_id": store_id}))
    return time.monotonic()

"""The dashboard routes: ``/info`` and the ``/alerts`` WebSocket, with Hermes's checks faked."""

import importlib.util
import json
import sys
import types

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from helpers import PLUGIN_DIR
from starlette.websockets import WebSocketDisconnect

SCHEMA = json.loads((PLUGIN_DIR.parent / "contract" / "hermes-bots-plugin.schema.json").read_text())


class HermesChecks:
    """Stands in for the Hermes checks ``/api/ws`` runs: chat switched on, login, and Host/Origin."""

    def __init__(self):
        self.chat_enabled = True
        self.login_ok = True
        self.origin_ok = True
        self.ticket_subprotocol = None

    def _ws_auth_ok(self, ws):
        ws._hermes_ws_subprotocol = self.ticket_subprotocol
        return self.login_ok

    def _ws_request_is_allowed(self, ws):
        return self.origin_ok


@pytest.fixture
def checks(monkeypatch):
    fake = HermesChecks()
    chat = types.ModuleType("hermes_cli.web_server_chat")
    chat._ws_auth_ok = fake._ws_auth_ok
    chat._ws_request_is_allowed = fake._ws_request_is_allowed
    native = types.ModuleType("hermes_cli.dashboard_auth.native_http")
    native.HEADER = "x-hermes-gateway-ticket"
    hermes_cli = types.ModuleType("hermes_cli")
    hermes_cli.web_server = ChatSwitch(fake)
    for name, module in {"hermes_cli": hermes_cli, "hermes_cli.web_server_chat": chat,
                         "hermes_cli.dashboard_auth": types.ModuleType("hermes_cli.dashboard_auth"),
                         "hermes_cli.dashboard_auth.native_http": native}.items():
        monkeypatch.setitem(sys.modules, name, module)
    return fake


class ChatSwitch:
    """Stands in for ``hermes_cli.web_server``, whose flag says whether the dashboard's chat is on."""

    def __init__(self, checks):
        self._checks = checks

    @property
    def _DASHBOARD_EMBEDDED_CHAT_ENABLED(self):
        return self._checks.chat_enabled


@pytest.fixture
def plugin_api(temp_store, monkeypatch):
    spec = importlib.util.spec_from_file_location("hermes_bots_plugin_api", PLUGIN_DIR / "dashboard" / "plugin_api.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    monkeypatch.setattr(module.store, "store_path", lambda: temp_store)
    monkeypatch.setattr(module, "POLL_S", 0.01)
    return module


@pytest.fixture
def client(plugin_api, checks):
    app = FastAPI()
    app.include_router(plugin_api.router)
    return TestClient(app)


def _add_alert(plugin_api, kind="approval", ref="r1"):
    return plugin_api.store.add_alert(bot="junior", kind=kind, session_id="s1", ref=ref)


def _keys(definition):
    return set(SCHEMA["$defs"][definition]["properties"])


def test_info_reports_the_running_version_and_the_newest_alert(client, plugin_api):
    _add_alert(plugin_api)
    info = client.get("/info").json()
    assert set(info) == _keys("Info")
    assert (info["plugin"], info["version"], info["latest_alert_id"]) == ("hermes-bots", plugin_api.version.VERSION, 1)


@pytest.mark.parametrize("failing_check", ["chat_enabled", "login_ok", "origin_ok"])
def test_the_socket_refuses_what_api_ws_refuses(client, checks, failing_check):
    setattr(checks, failing_check, False)
    with pytest.raises(WebSocketDisconnect) as refused:
        with client.websocket_connect("/alerts"):
            pass
    assert refused.value.code == 1008


def test_the_desktop_sign_in_header_is_refused_like_on_api_ws(client):
    with pytest.raises(WebSocketDisconnect) as refused:
        with client.websocket_connect("/alerts", headers={"X-Hermes-Gateway-Ticket": "grant"}):
            pass
    assert refused.value.code == 1008


def test_a_malformed_since_is_refused(client):
    with pytest.raises(WebSocketDisconnect) as refused:
        with client.websocket_connect("/alerts?since=yesterday"):
            pass
    assert refused.value.code == 1008


def test_since_replays_later_alerts_in_order(client, plugin_api):
    first, second, third = (_add_alert(plugin_api, ref=f"r{n}") for n in range(3))
    with client.websocket_connect(f"/alerts?since={first}") as ws:
        received = [ws.receive_json(), ws.receive_json()]
    assert [alert["id"] for alert in received] == [second, third]
    assert set(received[0]) == _keys("Alert")
    assert received[0]["type"] == "alert"


def test_without_since_the_stream_starts_after_the_newest_alert(client, plugin_api, monkeypatch):
    _add_alert(plugin_api)
    monkeypatch.setattr(plugin_api, "PING_EVERY_S", 0.0)
    with client.websocket_connect("/alerts") as ws:
        assert ws.receive_json() == {"type": "ping", "latest_alert_id": 1}


def test_a_quiet_stream_pings(client, plugin_api, monkeypatch):
    monkeypatch.setattr(plugin_api, "PING_EVERY_S", 0.0)
    with client.websocket_connect("/alerts?since=0") as ws:
        ping = ws.receive_json()
    assert set(ping) == _keys("Ping") and ping["type"] == "ping"


def test_a_ticket_sent_as_a_subprotocol_is_echoed(client, checks, plugin_api, monkeypatch):
    checks.ticket_subprotocol = "hermes-gateway-v1"
    monkeypatch.setattr(plugin_api, "PING_EVERY_S", 0.0)
    with client.websocket_connect("/alerts", subprotocols=["hermes-gateway-v1", "hermes-gateway-ticket.t"]) as ws:
        assert ws.accepted_subprotocol == "hermes-gateway-v1"
        ws.receive_json()

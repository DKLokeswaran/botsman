"""The alert socket accepts only what ``/api/ws`` accepts: a fresh ticket and an allowed Origin."""

import asyncio
import json

import pytest
import websockets
from hermes_client import WS_URL, AlertStream, ticket

ALERTS = f"{WS_URL}/api/plugins/hermes-bots/alerts"


async def _opens(url: str, **kwargs) -> bool:
    try:
        async with websockets.connect(url, open_timeout=10, **kwargs):
            return True
    except websockets.exceptions.InvalidStatus as exc:
        assert exc.response.status_code == 403
        return False


def _cookie_header(client) -> str:
    return "; ".join(f"{name}={value}" for name, value in client.cookies.items())


def test_a_fresh_ticket_opens_the_socket_once(client):
    fresh = ticket(client)
    assert asyncio.run(_opens(f"{ALERTS}?ticket={fresh}"))
    assert not asyncio.run(_opens(f"{ALERTS}?ticket={fresh}"))


def test_a_ticket_in_the_subprotocol_opens_the_socket(client):
    protocols = ["hermes-gateway-v1", f"hermes-gateway-ticket.{ticket(client)}"]
    assert asyncio.run(_opens(ALERTS, subprotocols=protocols))


@pytest.mark.parametrize("headers", [{}, "cookie", {"Cookie": "hermes_session=forged"}])
def test_no_ticket_is_refused_even_with_the_login_cookie(client, headers):
    if headers == "cookie":
        headers = {"Cookie": _cookie_header(client)}
    assert not asyncio.run(_opens(ALERTS, additional_headers=headers))


def test_a_foreign_origin_is_refused_even_with_a_ticket(client):
    url = f"{ALERTS}?ticket={ticket(client)}"
    assert not asyncio.run(_opens(url, origin="https://evil.example"))


def test_since_replays_alerts_after_that_id(client, chats, jobs, profiles):
    async def scenario():
        latest = client.get("/api/plugins/hermes-bots/info").json()["latest_alert_id"]
        profile = profiles[0]
        job = jobs(profile, f"hbapp:session-{chats[profile]}/replay", "hb_short.py")
        async with AlertStream(client) as live:
            await asyncio.to_thread(client.post, f"/api/cron/jobs/{job['id']}/trigger", params={"profile": profile})
            await live.wait_for("routine", chats[profile])
        async with AlertStream(client, since=latest) as replay:
            alert = await replay.wait_for("routine", chats[profile], timeout=10)
        assert set(alert) == {"type", "id", "ts", "bot", "kind", "session_id", "ref"}
        assert alert["id"] > latest and alert["bot"] == profile
    asyncio.run(scenario())


def test_a_quiet_stream_pings(client, monkeypatch):
    async def scenario():
        async with websockets.connect(f"{ALERTS}?ticket={ticket(client)}") as ws:
            message = json.loads(await asyncio.wait_for(ws.recv(), 30))
        assert message["type"] in ("ping", "alert")
    asyncio.run(scenario())

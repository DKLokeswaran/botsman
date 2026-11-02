"""The plugin is installed per profile, and the dashboard runs this version."""

import asyncio

import httpx

from hermes_bots.version import VERSION
from hermes_client import BASE_URL, Rpc


def _plugin_entry(client, profile: str):
    async def listing():
        async with Rpc(client) as rpc:
            return await rpc.call("plugins.manage", {"action": "list", "profile": profile})
    plugins = asyncio.run(listing())["plugins"]
    return next((p for p in plugins if p["name"] == "hermes-bots"), None)


def test_each_bot_profile_has_this_version_enabled_and_pinned(client, profiles):
    for profile in profiles:
        entry = _plugin_entry(client, profile)
        assert entry is not None, profile
        assert (entry["version"], entry["status"]) == (VERSION, "enabled"), profile
        assert len(entry.get("pinned_sha") or "") == 40, profile


def test_a_profile_without_the_plugin_reports_none(client, profile_without_plugin):
    assert _plugin_entry(client, profile_without_plugin) is None


def test_the_dashboard_runs_this_version(client):
    info = client.get("/api/plugins/hermes-bots/info").json()
    assert info["plugin"] == "hermes-bots"
    assert info["version"] == VERSION
    assert info["store_schema"] == 1
    assert isinstance(info["latest_alert_id"], int)


def test_info_needs_the_login():
    assert httpx.get(f"{BASE_URL}/api/plugins/hermes-bots/info").status_code == 401

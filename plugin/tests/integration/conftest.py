"""Integration tests against a Hermes test instance; never point them at a live Hermes.

Environment:
- ``HB_TEST_URL``: dashboard URL of the test instance, for example ``http://100.113.35.96:9129``
- ``HB_TEST_USER`` and ``HB_TEST_PASSWORD_FILE``: the dashboard login
- ``HB_TEST_HOME``: the instance's ``HERMES_HOME``; the tests write their routine scripts there
- ``HB_TEST_PROFILES``: two profiles with the plugin installed, for example ``default,spike2``
- ``HB_TEST_PROFILE_WITHOUT_PLUGIN``: a profile without it, for example ``spike3``

The plugin must already be installed with ``install_plugin.py``, and the gateway and dashboard
restarted, with ``HERMES_BOTS_FINISHED_AFTER_S=5`` in both processes' environment.
"""

import asyncio
import os
import sys
import uuid
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

from hermes_client import login  # noqa: E402
from live import new_chat  # noqa: E402

SCRIPTS = {
    "hb_short.py": 'print("HB-SHORT-OK")\n',
    "hb_long.py": 'print("HB-LONG-START " + "abcdefghij" * 500 + " HB-LONG-END")\n',
    "hb_fail.py": 'import sys\nprint("about to fail")\nsys.exit(3)\n',
    "hb_marker.py": 'print("HB-MARKER-ZULU-4: the routine says the reservoir is at 73 percent")\n',
}


def pytest_collection_modifyitems(config, items):
    if os.environ.get("HB_TEST_URL"):
        return
    skip = pytest.mark.skip(reason="HB_TEST_URL is not set; integration tests need a Hermes test instance")
    for item in items:
        if "integration" in str(item.fspath):
            item.add_marker(skip)


def _profile_home(profile: str) -> Path:
    home = Path(os.environ["HB_TEST_HOME"])
    return home if profile == "default" else home / "profiles" / profile


@pytest.fixture(scope="session")
def profiles() -> list[str]:
    return os.environ.get("HB_TEST_PROFILES", "default").split(",")


@pytest.fixture(scope="session")
def profile_without_plugin() -> str:
    return os.environ.get("HB_TEST_PROFILE_WITHOUT_PLUGIN", "")


@pytest.fixture(scope="session")
def client(profiles, profile_without_plugin):
    for profile in [*profiles, profile_without_plugin]:
        if profile:
            scripts = _profile_home(profile) / "scripts"
            scripts.mkdir(parents=True, exist_ok=True)
            for name, body in SCRIPTS.items():
                (scripts / name).write_text(body)
    return login()


@pytest.fixture
def jobs(client):
    """Creates routines and deletes them after the test."""
    created = []

    def create(profile: str, deliver: str, script: str, schedule: str = "0 0 1 1 *", name: str = "") -> dict:
        name = name or f"hb-test-{uuid.uuid4().hex[:6]}"
        response = client.post("/api/cron/jobs", params={"profile": profile}, json={
            "name": name, "schedule": schedule, "script": script, "no_agent": True, "deliver": deliver})
        response.raise_for_status()
        job = response.json()
        job = job.get("job", job)
        created.append((profile, job["id"]))
        return job

    yield create
    for profile, job_id in created:
        client.delete(f"/api/cron/jobs/{job_id}", params={"profile": profile})


@pytest.fixture(scope="session")
def chats(client, profiles) -> dict[str, str]:
    """One chat per plugin profile, shared by the routine tests."""
    return {profile: asyncio.run(new_chat(client, profile)) for profile in profiles}


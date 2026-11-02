"""Rows a stopped worker left claimed are written at once, through Hermes's own dead-holder probe.

The test stamps the stopped worker with this machine's PID namespace, so it needs a Linux test
instance on the same host and in the same PID namespace as the test run, as the rest of the
integration suite does.
"""

import os
import sqlite3
import subprocess
import sys
import time
import uuid
from pathlib import Path

import pytest
from live import profile_home, wait_for_routine_row

pytestmark = pytest.mark.skipif(not Path("/proc/self/ns/pid").exists(),
                                reason="needs a Linux PID namespace to stamp the stopped worker")


def _stopped_worker_id() -> str:
    """A worker id in the plugin's format, stamped with this host's PID namespace, whose process has exited."""
    process = subprocess.Popen([sys.executable, "-c", "pass"])
    process.wait()
    _wait_until_pid_is_free(process.pid)
    namespace = os.stat("/proc/self/ns/pid").st_ino
    return f"hermes-bots:pid={process.pid}:pidns={namespace}:{uuid.uuid4().hex[:8]}"


def _wait_until_pid_is_free(pid: int) -> None:
    """Skip when the PID was reused at once, since the probe would then rightly read it as alive."""
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return
    pytest.skip(f"PID {pid} was reused before the test could use it")


def _queue_claimed_row(profile: str, session_id: str, routine: str, worker_id: str) -> None:
    """Put a row in the shared store as a worker would leave it when its process stops mid-delivery."""
    store = Path(os.environ["HB_TEST_HOME"]) / "plugin-data" / "hermes-bots" / "hermes-bots.db"
    now = time.time()
    with sqlite3.connect(store) as conn:
        conn.execute(
            "INSERT INTO deliveries (created_at, bot, db_path, session_id, routine, text, failed, message_uid,"
            " next_attempt_at, claimed_by, claimed_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)",
            (now, profile, str(profile_home(profile) / "state.db"), session_id, routine,
             f"[Routine: {routine}]\nHB-RECOVERED", uuid.uuid4().hex, now, worker_id, now))


def test_a_row_claimed_by_a_stopped_worker_is_written_without_waiting_for_the_claim_timeout(client, chats, profiles):
    profile = profiles[0]
    _queue_claimed_row(profile, chats[profile], "Recovered", _stopped_worker_id())
    row = wait_for_routine_row(client, profile, chats[profile], "Recovered", timeout=20)
    assert row["content"] == "[Routine: Recovered]\nHB-RECOVERED"

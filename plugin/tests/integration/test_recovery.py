"""Rows a stopped worker left claimed are written at once, through Hermes's own dead-holder probe."""

import os
import sqlite3
import subprocess
import time
import uuid
from pathlib import Path

from live import profile_home, wait_for_routine_row


def _stopped_worker_id() -> str:
    """A worker id in the plugin's format whose process has exited, stamped with this host's PID namespace."""
    process = subprocess.Popen(["true"])
    process.wait()
    namespace = os.stat("/proc/self/ns/pid").st_ino
    return f"hermes-bots:pid={process.pid}:pidns={namespace}:stopped"


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

import os
import re
import sqlite3
import sys
import time
import types

import pytest
from helpers import all_alerts, delivery_row

from hermes_bots import delivery, store


class FakeSessionDB:
    """The SessionDB methods the delivery worker uses, with one turn lease per chat.

    Messages also go into a SQLite file with Hermes's ``messages`` columns that the worker reads.
    """

    def __init__(self, path):
        self.path = path
        with sqlite3.connect(path) as conn:
            conn.execute("CREATE TABLE messages (id INTEGER PRIMARY KEY, session_id TEXT, message_uid TEXT)")
        self.sessions = {"s1": "s1", "old": "tip"}
        self.lease_holder = None
        self.messages = []
        self.message_uids = []
        self.fail_with = None
        self.release_fails = False

    def get_session(self, session_id):
        return {"id": session_id} if session_id in self.sessions else None

    def resolve_resume_session_id(self, session_id):
        return self.sessions.get(session_id, session_id)

    def try_acquire_session_turn_lease(self, session_id, holder, ttl_seconds):
        if self.lease_holder is not None:
            return False
        self.lease_holder = holder
        return True

    def release_session_turn_lease(self, session_id, holder):
        assert self.lease_holder == holder
        self.lease_holder = None
        if self.release_fails:
            raise sqlite3.OperationalError("database is locked")

    def append_message(self, session_id, role, content, turn_lease_holder, message_uid):
        if self.fail_with:
            raise self.fail_with
        assert turn_lease_holder is not None and turn_lease_holder == self.lease_holder
        self.messages.append((session_id, role, content))
        self.message_uids.append(message_uid)
        with sqlite3.connect(self.path) as conn:
            return conn.execute("INSERT INTO messages (session_id, message_uid) VALUES (?, ?)",
                                (session_id, message_uid)).lastrowid


@pytest.fixture
def db(monkeypatch, tmp_path):
    fake = FakeSessionDB(tmp_path / "state.db")
    registry = types.ModuleType("hermes_state_registry")
    registry.acquire = lambda path: fake
    registry.release_or_close = lambda handle: None
    monkeypatch.setitem(sys.modules, "hermes_state_registry", registry)
    monkeypatch.setattr(delivery, "_active_db_path", lambda: fake.path)
    monkeypatch.setattr(delivery, "ensure_worker_running", lambda: None)
    return fake


def _queue(chat_id="session-s1/Morning%20briefing", content="Good morning."):
    return delivery.queue_routine_output(chat_id, content)


def test_queued_output_is_written_as_the_bots_message_and_alerts(db):
    row_id = _queue()
    assert delivery.process_next() is True
    assert db.messages == [("s1", "assistant", "[Routine: Morning briefing]\nGood morning.")]
    assert delivery_row(row_id)["state"] == "written"
    assert all_alerts() == [("junior", "routine", "s1", None)]
    assert delivery.process_next() is False


def test_output_goes_to_the_chats_current_tip_but_alerts_name_the_stored_id(db):
    _queue("session-old/News")
    delivery.process_next()
    assert db.messages[0][0] == "tip"
    assert all_alerts() == [("junior", "routine", "old", None)]


def test_a_failed_run_is_written_and_raises_the_failure_alert(db):
    _queue(content="⚠️ Cron 'News' failed: provider error.")
    delivery.process_next()
    assert db.messages[0][2] == "[Routine: Morning briefing]\n⚠️ Cron 'News' failed: provider error."
    assert all_alerts() == [("junior", "routine_failed", "s1", None)]


def test_a_running_reply_defers_the_write(db):
    db.lease_holder = "a running turn"
    row_id = _queue()
    delivery.process_next()
    row = delivery_row(row_id)
    assert (row["state"], row["claimed_by"], row["attempts"]) == ("pending", None, 0)
    assert row["next_attempt_at"] > time.time()
    assert db.messages == [] and all_alerts() == []


def _make_due(row_id, **columns):
    """Make a deferred or claimed row claimable now, optionally changing other columns."""
    columns = {"next_attempt_at": 0, "claimed_at": 0, **columns}
    assignments = ", ".join(f"{name} = ?" for name in columns)
    with store.open_store() as conn:
        conn.execute(f"UPDATE deliveries SET {assignments} WHERE id = ?", (*columns.values(), row_id))


def test_a_chat_busy_past_the_limit_drops_the_row_and_alerts(db):
    db.lease_holder = "a running turn"
    row_id = _queue()
    started = time.time() - delivery.BUSY_LIMIT_S - 1
    _make_due(row_id, busy_since=started, next_attempt_at=time.time())
    delivery.process_next()
    assert delivery_row(row_id)["state"] == "dropped"
    assert all_alerts() == [("junior", "routine_failed", "s1", None)]


def test_a_gap_in_busy_checks_starts_a_new_busy_stretch(db):
    db.lease_holder = "a running turn"
    row_id = _queue()
    long_ago = time.time() - delivery.BUSY_LIMIT_S - 1
    _make_due(row_id, busy_since=long_ago, next_attempt_at=long_ago)
    delivery.process_next()
    row = delivery_row(row_id)
    assert row["state"] == "pending" and row["busy_since"] > long_ago


def test_an_error_retry_ends_the_busy_stretch(db):
    db.lease_holder = "a running turn"
    row_id = _queue()
    delivery.process_next()
    assert delivery_row(row_id)["busy_since"] is not None
    db.lease_holder = None
    db.fail_with = sqlite3.OperationalError("database is locked")
    _make_due(row_id)
    delivery.process_next()
    assert delivery_row(row_id)["busy_since"] is None


def test_a_row_that_waited_in_the_queue_is_not_dropped_on_its_first_busy_attempt(db):
    db.lease_holder = "a running turn"
    row_id = _queue()
    _make_due(row_id, created_at=0)
    delivery.process_next()
    assert delivery_row(row_id)["state"] == "pending"
    assert all_alerts() == []


def test_a_failed_lease_release_still_counts_the_write_once(db):
    db.release_fails = True
    row_id = _queue()
    delivery.process_next()
    assert delivery_row(row_id)["state"] == "written"
    assert len(db.messages) == 1
    assert all_alerts() == [("junior", "routine", "s1", None)]


def test_a_write_whose_bookkeeping_was_lost_is_not_written_again(db, monkeypatch):
    row_id = _queue()
    finish = store.finish_delivery

    def stopped_process(*args, **kwargs):
        raise sqlite3.OperationalError("database is locked")
    monkeypatch.setattr(store, "finish_delivery", stopped_process)
    with pytest.raises(sqlite3.OperationalError):
        delivery.process_next()
    monkeypatch.setattr(store, "finish_delivery", finish)
    _make_due(row_id)
    delivery.process_next()
    row = delivery_row(row_id)
    assert (row["state"], row["message_id"]) == ("written", 1)
    assert len(db.messages) == 1
    assert all_alerts() == [("junior", "routine", "s1", None)]


def test_a_missing_chat_drops_the_row_at_once(db):
    row_id = _queue("session-gone/News")
    delivery.process_next()
    row = delivery_row(row_id)
    assert (row["state"], row["error"]) == ("dropped", "chat gone not found")
    assert all_alerts() == [("junior", "routine_failed", "gone", None)]


def test_unexpected_errors_retry_with_backoff_then_drop(db, monkeypatch):
    db.fail_with = sqlite3.OperationalError("database is locked")
    row_id = _queue()
    for attempt in range(1, delivery.MAX_ATTEMPTS):
        delivery.process_next()
        row = delivery_row(row_id)
        assert (row["state"], row["attempts"]) == ("pending", attempt)
        assert db.lease_holder is None
        _make_due(row_id)  # skip the backoff wait
    delivery.process_next()
    assert delivery_row(row_id)["state"] == "dropped"
    assert all_alerts() == [("junior", "routine_failed", "s1", None)]


def test_a_malformed_target_is_refused_before_queuing(db):
    with pytest.raises(ValueError):
        _queue("chat-s1/News")
    assert store.claim_next_delivery("w") is None


def test_a_worker_that_lost_its_claim_does_not_write(db):
    row_id = _queue()
    row = store.claim_next_delivery(delivery.WORKER_ID)
    _make_due(row_id)
    store.claim_next_delivery("another worker")
    with pytest.raises(delivery.ClaimLost):
        delivery.write_under_lease(row)
    assert db.messages == [] and db.lease_holder is None
    assert delivery_row(row_id)["claimed_by"] == "another worker"


def test_a_worker_that_lost_its_claim_before_finishing_raises_no_alert(db):
    row_id = _queue()
    row = store.claim_next_delivery(delivery.WORKER_ID)
    _make_due(row_id)
    store.claim_next_delivery("another worker")
    delivery._after_attempt(row, message_id=1)
    assert delivery_row(row_id)["state"] == "pending"
    assert all_alerts() == []


def test_a_lost_claim_leaves_the_row_to_the_worker_that_took_it(db, monkeypatch):
    row_id = _queue()

    def taken_over(row):
        raise delivery.ClaimLost()
    monkeypatch.setattr(delivery, "write_under_lease", taken_over)
    delivery.process_next()
    row = delivery_row(row_id)
    assert (row["state"], row["claimed_by"], row["attempts"]) == ("pending", delivery.WORKER_ID, 0)
    assert all_alerts() == []


def test_worker_ids_carry_hermess_pid_namespace_stamp(monkeypatch):
    pidns = types.ModuleType("hermes_state_pidns")
    pidns.holder_namespace_token = lambda: ":pidns=4026531836"
    monkeypatch.setitem(sys.modules, "hermes_state_pidns", pidns)
    worker_id = delivery._new_worker_id()
    # The two patterns Hermes's dead-holder probe reads a holder with
    assert re.search(r"(?:^|:)pid=(\d+)(?::|$)", worker_id).group(1) == str(os.getpid())
    assert re.search(r"(?:^|:)pidns=(\d+)(?::|$)", worker_id).group(1) == "4026531836"

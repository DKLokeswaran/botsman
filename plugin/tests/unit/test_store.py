import os
import sqlite3
import time
import uuid

from hermes_bots import store


def _enqueue(session_id, db_path="/home/a/state.db", routine="News"):
    return store.enqueue_delivery(bot="junior", db_path=db_path, session_id=session_id, routine=routine,
                                  text=f"[Routine: {routine}]\nx", failed=False,
                                  message_uid=uuid.uuid4().hex)


def test_rows_of_one_chat_are_claimed_in_order_one_at_a_time():
    first, second = _enqueue("s1"), _enqueue("s1")
    assert store.claim_next_delivery("w1")["id"] == first
    assert store.claim_next_delivery("w2") is None
    store.finish_delivery(first, "w1", state="written", message_id=7)
    assert store.claim_next_delivery("w2")["id"] == second


def test_a_busy_chat_does_not_hold_up_other_chats():
    busy, other = _enqueue("s1"), _enqueue("s2")
    assert store.claim_next_delivery("w1")["id"] == busy
    assert store.claim_next_delivery("w2")["id"] == other


def test_the_same_session_id_in_another_profile_is_another_chat():
    a, b = _enqueue("s1", "/home/a/state.db"), _enqueue("s1", "/home/b/state.db")
    assert store.claim_next_delivery("w1")["id"] == a
    assert store.claim_next_delivery("w2")["id"] == b


def test_a_deferred_row_waits_until_it_is_due():
    row_id = _enqueue("s1")
    store.claim_next_delivery("w1")
    store.defer_delivery(row_id, "w1", retry_at=time.time() + 60, error="busy", count_attempt=True)
    assert store.claim_next_delivery("w1") is None
    row = store.get_delivery(row_id)
    assert (row["attempts"], row["error"], row["claimed_by"]) == (1, "busy", None)


def test_a_claim_left_by_a_stopped_process_is_taken_over(monkeypatch):
    row_id = _enqueue("s1")
    store.claim_next_delivery("dead-worker")
    monkeypatch.setattr(store, "CLAIM_TIMEOUT_S", -1.0)
    assert store.claim_next_delivery("w2")["id"] == row_id


def test_only_the_claiming_worker_can_finish_a_row():
    row_id = _enqueue("s1")
    store.claim_next_delivery("w1")
    store.finish_delivery(row_id, "w2", state="written", message_id=1)
    assert store.get_delivery(row_id)["state"] == "pending"
    store.finish_delivery(row_id, "w1", state="written", message_id=1)
    assert store.get_delivery(row_id)["state"] == "written"


def test_alert_ids_increase_and_survive_pruning():
    first = store.add_alert(bot="junior", kind="approval", session_id="s1", ref="r1")
    second = store.add_alert(bot="junior", kind="resolved", session_id="s1", ref="r1")
    assert second > first
    assert [row["id"] for row in store.alerts_after(first)] == [second]
    store.prune(now=time.time() + store.RETENTION_S + 1)
    assert store.alerts_after(0) == []
    assert store.latest_alert_id() == second
    assert store.add_alert(bot="junior", kind="finished", session_id="s1") > second


def test_latest_alert_id_is_zero_on_a_new_store():
    assert store.latest_alert_id() == 0


def test_prune_keeps_pending_deliveries():
    pending, done = _enqueue("s1"), _enqueue("s2")
    store.claim_next_delivery("w")
    claimed = store.claim_next_delivery("w")
    store.finish_delivery(claimed["id"], "w", state="written", message_id=1)
    store.prune(now=time.time() + store.RETENTION_S + 1)
    assert store.get_delivery(pending) is not None
    assert store.get_delivery(done) is None


def test_reads_need_no_write_lock_once_the_store_is_set_up(temp_store):
    store.add_alert(bot="junior", kind="routine", session_id="s1")
    writer = sqlite3.connect(temp_store, isolation_level=None)
    writer.execute("BEGIN IMMEDIATE")
    try:
        assert len(store.alerts_after(0)) == 1
        assert store.latest_alert_id() == 1
    finally:
        writer.execute("ROLLBACK")
        writer.close()


def test_a_deferral_records_or_clears_the_busy_stretch():
    row_id = _enqueue("s1")
    store.claim_next_delivery("w1")
    store.defer_delivery(row_id, "w1", retry_at=0, busy_since=123.0)
    assert store.get_delivery(row_id)["busy_since"] == 123.0
    store.claim_next_delivery("w1")
    store.defer_delivery(row_id, "w1", retry_at=0, error="locked", count_attempt=True)
    assert store.get_delivery(row_id)["busy_since"] is None


def test_a_claim_held_by_a_stopped_process_is_released_at_once():
    row_id = _enqueue("s1")
    store.claim_next_delivery("hermes-bots:pid=999999999:dead")
    assert store.claim_next_delivery("w2")["id"] == row_id


def test_a_claim_held_by_a_running_process_is_kept():
    _enqueue("s1")
    store.claim_next_delivery(f"hermes-bots:pid={os.getpid()}:live")
    assert store.claim_next_delivery("w2") is None

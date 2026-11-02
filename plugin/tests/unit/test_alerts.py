import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor

import pytest
from helpers import all_alerts

from hermes_bots import alerts, store

CHAT = {"session_id": "20261031_211945_074dcb", "session_key": "20261031_211945_074dcb", "platform": "tui",
        "prompt": "rm -rf /tmp/x", "telemetry_schema_version": "hermes.observer.v1"}
TURN = {"session_id": "s1", "task_id": "s1", "turn_id": "s1:s1:b1c0e778", "model": "m", "platform": "tui"}


@pytest.fixture(autouse=True)
def clean_turns():
    alerts._turn_starts.clear()


def test_approval_and_question_requests_and_their_resolution_raise_alerts():
    alerts.on_human_input_request(kind="approval", request_id="r1", **CHAT)
    alerts.on_human_input_request(kind="clarify", request_id="r2", **CHAT)
    alerts.on_human_input_resolved(kind="approval", request_id="r1", outcome="once", **CHAT)
    sid = CHAT["session_id"]
    assert all_alerts() == [("junior", "approval", sid, "r1"), ("junior", "question", sid, "r2"),
                            ("junior", "resolved", sid, "r1")]


def test_other_human_input_kinds_raise_nothing():
    alerts.on_human_input_request(kind="sudo", request_id="r1", **CHAT)
    alerts.on_human_input_resolved(kind="sudo", request_id="r1", outcome="submitted", **CHAT)
    assert all_alerts() == []


def test_alerts_never_carry_the_prompt_text():
    alerts.on_human_input_request(kind="approval", request_id="r1", **CHAT)
    assert "rm -rf" not in repr(all_alerts())


def test_a_long_completed_reply_raises_finished(monkeypatch):
    monkeypatch.setattr(alerts, "FINISHED_AFTER_S", 0.0)
    alerts.on_pre_llm_call(user_message="hi", **TURN)
    alerts.on_session_end(completed=True, failed=False, interrupted=False, **TURN)
    assert all_alerts() == [("junior", "finished", "s1", TURN["turn_id"])]
    assert alerts._turn_starts == {}


def test_a_short_reply_raises_nothing():
    alerts.on_pre_llm_call(**TURN)
    alerts.on_session_end(completed=True, **TURN)
    assert all_alerts() == []


def test_an_interrupted_reply_raises_nothing(monkeypatch):
    monkeypatch.setattr(alerts, "FINISHED_AFTER_S", 0.0)
    alerts.on_pre_llm_call(**TURN)
    alerts.on_session_end(completed=False, interrupted=True, **TURN)
    assert all_alerts() == []


def test_a_client_disconnect_without_a_turn_raises_nothing(monkeypatch):
    monkeypatch.setattr(alerts, "FINISHED_AFTER_S", 0.0)
    alerts.on_session_end(completed=False, interrupted=True, session_id="s1")
    assert all_alerts() == []


def test_the_first_start_of_a_turn_counts(monkeypatch):
    alerts.on_pre_llm_call(**TURN)
    first = alerts._turn_starts[TURN["turn_id"]]
    alerts.on_pre_llm_call(**TURN)
    assert alerts._turn_starts[TURN["turn_id"]] == first


def test_routine_runs_raise_nothing(monkeypatch):
    monkeypatch.setattr(alerts, "FINISHED_AFTER_S", 0.0)
    cron = {**TURN, "task_id": "cron:6ef9393ac6bd:b992ae5c"}
    alerts.on_pre_llm_call(**cron)
    alerts.on_session_end(completed=True, **cron)
    alerts.on_human_input_request(kind="approval", request_id="r1", **{**CHAT, "task_id": "cron:x"})
    assert all_alerts() == []


def test_a_failing_hook_never_raises_into_hermes(monkeypatch):
    def broken():
        raise RuntimeError("no profile")
    monkeypatch.setattr(alerts, "active_bot", broken)
    assert alerts.on_human_input_request(kind="approval", request_id="r1", **CHAT) is None
    assert all_alerts() == []


def test_a_malformed_finished_threshold_falls_back_to_the_default(monkeypatch):
    monkeypatch.setenv("HERMES_BOTS_FINISHED_AFTER_S", "5s")
    assert alerts._finished_after_s() == alerts.DEFAULT_FINISHED_AFTER_S
    monkeypatch.setenv("HERMES_BOTS_FINISHED_AFTER_S", "5")
    assert alerts._finished_after_s() == 5.0


def test_a_hook_does_not_wait_for_a_locked_store(temp_store, monkeypatch):
    writer = ThreadPoolExecutor(max_workers=1)
    monkeypatch.setattr(alerts, "_hook_alert_writer", writer)
    store.add_alert(bot="junior", kind="routine", session_id="s0")
    holder = sqlite3.connect(temp_store, isolation_level=None)
    holder.execute("BEGIN IMMEDIATE")
    started = time.monotonic()
    alerts.on_human_input_request(kind="approval", request_id="r1", session_id="s1")
    took = time.monotonic() - started
    holder.execute("ROLLBACK")
    holder.close()
    writer.shutdown(wait=True)
    assert took < 0.5
    assert all_alerts()[-1] == ("junior", "approval", "s1", "r1")


def test_a_delegated_subagent_turn_raises_no_finished_alert(monkeypatch):
    monkeypatch.setattr(alerts, "FINISHED_AFTER_S", 0.0)
    child = {**TURN, "session_id": "child", "task_id": "sa-0-1a2b3c4d", "turn_id": "child:t1"}
    alerts.on_pre_llm_call(parent_session_id="s1", **child)
    alerts.on_session_end(completed=True, interrupted=False, **child)
    assert all_alerts() == []


def test_a_failed_reply_raises_an_error_alert_at_once():
    alerts.on_pre_llm_call(**TURN)
    alerts.on_session_end(completed=False, failed=True, interrupted=False, **TURN)
    assert all_alerts() == [("junior", "error", "s1", TURN["turn_id"])]


def test_an_interrupted_reply_raises_no_error_alert():
    alerts.on_pre_llm_call(**TURN)
    alerts.on_session_end(completed=False, failed=True, interrupted=True, **TURN)
    assert all_alerts() == []


def test_a_failed_subagent_turn_raises_no_error_alert():
    child = {**TURN, "session_id": "child", "task_id": "sa-0-1a2b3c4d", "turn_id": "child:t1"}
    alerts.on_pre_llm_call(parent_session_id="s1", **child)
    alerts.on_session_end(completed=False, failed=True, interrupted=False, **child)
    assert all_alerts() == []

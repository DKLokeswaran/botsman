"""Hook alerts reach the apps only for the bot's app chat, named by its stored id."""

import json
import sys
import types

import pytest
from helpers import all_alerts

from hermes_bots import alerts, app_chat

REAL_LOOKUP = app_chat.app_chat_of


class FakeSessionDB:
    """Knows which session each chat continues in after compression."""

    def __init__(self, continuations):
        self.continuations = continuations

    def resolve_resume_session_id(self, session_id):
        return self.continuations.get(session_id, session_id)


@pytest.fixture
def bot_home(tmp_path, monkeypatch):
    """A profile home with Hermes's YAML reader and session database faked; JSON is valid YAML."""
    hermes_yaml = types.ModuleType("hermes_yaml")
    hermes_yaml.safe_load = json.loads
    monkeypatch.setitem(sys.modules, "hermes_yaml", hermes_yaml)
    db = FakeSessionDB({})
    registry = types.ModuleType("hermes_state_registry")
    registry.acquire = lambda path: db
    registry.release_or_close = lambda handle: None
    monkeypatch.setitem(sys.modules, "hermes_state_registry", registry)
    monkeypatch.setattr(app_chat, "app_chat_of", REAL_LOOKUP)
    return tmp_path, db


def _record_app_chat(home, chat_id):
    ui_meta = {"hermes-bots": {"title": "Junior"}, "hermes-bots-app": {"chat_session_id": chat_id}}
    (home / "profile.yaml").write_text(json.dumps({"ui_meta": ui_meta}))


def test_an_approval_in_the_app_chat_raises_an_alert(bot_home):
    home, _ = bot_home
    _record_app_chat(home, "chat1")
    alerts.on_human_input_request(kind="approval", request_id="r1", session_id="chat1")
    assert all_alerts() == [("junior", "approval", "chat1", "r1")]


def test_an_approval_in_another_session_of_the_bot_raises_nothing(bot_home):
    home, _ = bot_home
    _record_app_chat(home, "chat1")
    alerts.on_human_input_request(kind="approval", request_id="r1", session_id="telegram-session")
    assert all_alerts() == []


def test_a_bot_with_no_app_chat_yet_raises_no_hook_alerts(bot_home):
    alerts.on_human_input_request(kind="approval", request_id="r1", session_id="chat1")
    assert all_alerts() == []


def test_an_alert_from_a_compressed_chat_names_the_chats_stored_id(bot_home):
    home, db = bot_home
    _record_app_chat(home, "chat1")
    db.continuations["chat1"] = "chat1-continued"
    alerts.on_human_input_request(kind="clarify", request_id="r2", session_id="chat1-continued")
    assert all_alerts() == [("junior", "question", "chat1", "r2")]


@pytest.mark.parametrize("profile_yaml", ["", '{"ui_meta": "not a mapping"}',
                                          '{"ui_meta": {"hermes-bots-app": {"chat_session_id": ""}}}'])
def test_a_missing_or_malformed_record_means_no_app_chat(bot_home, profile_yaml):
    home, _ = bot_home
    (home / "profile.yaml").write_text(profile_yaml or "null")
    assert app_chat.recorded_chat_id(home) is None

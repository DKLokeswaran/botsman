import pytest

from hermes_bots import alerts, app_chat, store


@pytest.fixture(autouse=True)
def temp_store(tmp_path, monkeypatch):
    """Every unit test gets its own store file and runs as the bot ``junior``, whose app chat is every session.

    Tests of the app chat rule itself replace ``app_chat_of`` with the real lookup.
    """
    path = tmp_path / "hermes-bots.db"
    monkeypatch.setattr(store, "store_path", lambda: path)
    monkeypatch.setattr(alerts, "active_bot", lambda: "junior")
    monkeypatch.setattr(alerts, "_active_profile_home", lambda: tmp_path)
    monkeypatch.setattr(app_chat, "app_chat_of", lambda profile_home, session_id: session_id)
    monkeypatch.setattr(alerts, "_hook_alert_writer", ImmediateWriter())
    store._hermes_holder_probe.cache_clear()
    yield path
    store._hermes_holder_probe.cache_clear()


class ImmediateWriter:
    """Stands in for the hook alert thread so a test sees each alert as soon as the hook returns."""

    def submit(self, fn, *args):
        fn(*args)

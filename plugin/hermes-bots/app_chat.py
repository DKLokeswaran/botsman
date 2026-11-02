"""The bot's app chat: the one chat per bot the Hermes Bots apps show.

The apps record its stored session id in the profile's ``profile.yaml``, under
``ui_meta["hermes-bots-app"]["chat_session_id"]``, written with ``profiles.configure``. Hook alerts
are raised only for that chat; other sessions of the bot (other dashboard chats, the CLI, messaging
platforms) are left alone.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

UI_META_KEY = "hermes-bots-app"
CHAT_ID_FIELD = "chat_session_id"


def app_chat_of(profile_home: Path, session_id: str) -> Optional[str]:
    """The app chat's stored id when ``session_id`` is that chat or its current continuation, else None."""
    chat_id = recorded_chat_id(profile_home)
    if chat_id is None:
        return None
    if session_id == chat_id or session_id == _current_continuation(profile_home, chat_id):
        return chat_id
    return None


def recorded_chat_id(profile_home: Path) -> Optional[str]:
    """The app chat id the apps recorded in the profile, or None when there is none yet."""
    app_meta = (_read_ui_meta(profile_home) or {}).get(UI_META_KEY)
    chat_id = app_meta.get(CHAT_ID_FIELD) if isinstance(app_meta, dict) else None
    return chat_id if isinstance(chat_id, str) and chat_id else None


def _read_ui_meta(profile_home: Path) -> Optional[dict]:
    """The profile's ``ui_meta``, read the way Hermes reads ``profile.yaml``."""
    path = profile_home / "profile.yaml"
    if not path.is_file():
        return None
    import hermes_yaml
    data = hermes_yaml.safe_load(path.read_text(encoding="utf-8-sig")) or {}
    ui_meta = data.get("ui_meta") if isinstance(data, dict) else None
    return ui_meta if isinstance(ui_meta, dict) else None


def _current_continuation(profile_home: Path, chat_id: str) -> Optional[str]:
    """The session the chat continues in after Hermes compressed it; the chat itself when never compressed."""
    from hermes_state_registry import acquire, release_or_close
    db = acquire(profile_home / "state.db")
    try:
        return db.resolve_resume_session_id(chat_id)
    finally:
        release_or_close(db)

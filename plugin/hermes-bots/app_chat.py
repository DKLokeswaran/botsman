"""The bot's app chat: the one chat per bot the Hermes Bots apps show.

The apps record its stored session id in the profile's ``profile.yaml``, under
``ui_meta["hermes-bots-app"]["chat_session_id"]``, written with ``profiles.configure``. Hook alerts
are raised only for that chat: its own session, the sessions it continued in after compressions,
and the sessions of subagents it delegated to. Other sessions of the bot (other dashboard chats,
the CLI, messaging platforms) are left alone.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

UI_META_KEY = "hermes-bots-app"
CHAT_ID_FIELD = "chat_session_id"
MAX_PARENT_HOPS = 16


def app_chat_of(profile_home: Path, session_id: str) -> Optional[str]:
    """The app chat's stored id when ``session_id`` belongs to that chat, else None."""
    chat_id = recorded_chat_id(profile_home)
    if chat_id is None:
        return None
    if session_id == chat_id or _descends_from_chat(profile_home, session_id, chat_id):
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


def _descends_from_chat(profile_home: Path, session_id: str, chat_id: str) -> bool:
    """Whether ``session_id`` is in the chat's compression chain, or a subagent session started from it."""
    from hermes_state_registry import acquire, release_or_close
    db = acquire(profile_home / "state.db")
    try:
        chat_sessions = set(db.get_compression_chain(chat_id))
        return _reaches(db, session_id, chat_sessions)
    finally:
        release_or_close(db)


def _reaches(db, session_id: Optional[str], targets: set[str]) -> bool:
    """Follow parent links from ``session_id`` until one of ``targets`` is found or the chain ends."""
    for _ in range(MAX_PARENT_HOPS):
        if session_id is None:
            return False
        if session_id in targets:
            return True
        row = db.get_session(session_id)
        session_id = row.get("parent_session_id") if row else None
    return False

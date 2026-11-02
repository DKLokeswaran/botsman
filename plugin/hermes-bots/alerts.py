"""Alerts raised from Hermes hooks. An alert names the bot, the kind of event and the chat; never any text.

Alert kinds:
- ``approval``: a person is asked to approve a command
- ``question``: a person is asked clarifying questions
- ``resolved``: an approval or question was answered, denied or timed out
- ``finished``: a reply that ran for at least ``FINISHED_AFTER_S`` completed
- ``routine``: a routine's output was written into the chat
- ``routine_failed``: a routine reported a failure, or its output could not be written
"""

from __future__ import annotations

import functools
import logging
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Callable, Optional

from . import store

logger = logging.getLogger(__name__)

DEFAULT_FINISHED_AFTER_S = 60.0
_HUMAN_INPUT_KINDS = {"approval": "approval", "clarify": "question"}
_TURN_START_CAP = 2000
_TURN_START_MAX_AGE_S = 24 * 3600.0

_turn_starts: dict[str, float] = {}
_turn_lock = threading.Lock()

# One thread writes hook alerts in order, so a busy store never holds up the turn that raised them
_hook_alert_writer = ThreadPoolExecutor(max_workers=1, thread_name_prefix="hermes-bots-alerts")


def _finished_after_s() -> float:
    """``HERMES_BOTS_FINISHED_AFTER_S``, or the default when it is unset or not a number."""
    raw = os.environ.get("HERMES_BOTS_FINISHED_AFTER_S")
    if raw is None:
        return DEFAULT_FINISHED_AFTER_S
    try:
        return float(raw)
    except ValueError:
        logger.warning("HERMES_BOTS_FINISHED_AFTER_S=%r is not a number; using %s s", raw, DEFAULT_FINISHED_AFTER_S)
        return DEFAULT_FINISHED_AFTER_S


FINISHED_AFTER_S = _finished_after_s()


def active_bot() -> str:
    """The bot is the Hermes profile whose turn or delivery is running."""
    from hermes_cli.profiles import get_active_profile_name
    return get_active_profile_name()


def raise_alert(bot: str, kind: str, session_id: str, ref: Optional[str] = None) -> int:
    """Record an alert for the apps' alert stream; returns its id."""
    return store.add_alert(bot=bot, kind=kind, session_id=session_id, ref=ref)


def _raise_from_hook(kind: str, session_id: str, ref: Optional[str] = None) -> None:
    """Raise an alert for the running bot without making the hook wait for the store."""
    bot = active_bot()
    _hook_alert_writer.submit(_write_hook_alert, bot, kind, session_id, ref)


def _write_hook_alert(bot: str, kind: str, session_id: str, ref: Optional[str]) -> None:
    """Runs on the alert writer thread; a failure is logged and the alert is lost."""
    try:
        raise_alert(bot, kind, session_id, ref)
    except Exception:
        logger.exception("hermes-bots could not record a %s alert", kind)


def _observer(hook: Callable[..., None]) -> Callable[..., None]:
    """Hooks only observe: a failure is logged and never reaches Hermes."""
    @functools.wraps(hook)
    def wrapper(**kwargs) -> None:
        try:
            hook(**kwargs)
        except Exception:
            logger.exception("hermes-bots hook %s failed", hook.__name__)
        return None
    return wrapper


def _is_routine_run(kwargs: dict) -> bool:
    """Routine runs fire the same hooks; their results have their own alert."""
    return str(kwargs.get("task_id") or "").startswith("cron:")


# Approvals and questions

@_observer
def on_human_input_request(**kwargs) -> None:
    """Raise ``approval`` or ``question`` when a chat asks a person for input."""
    kind = _HUMAN_INPUT_KINDS.get(kwargs.get("kind"))
    session_id = kwargs.get("session_id")
    if kind and session_id and not _is_routine_run(kwargs):
        _raise_from_hook(kind, session_id, kwargs.get("request_id"))


@_observer
def on_human_input_resolved(**kwargs) -> None:
    """Raise ``resolved`` when that request is answered, denied or times out."""
    session_id = kwargs.get("session_id")
    if kwargs.get("kind") in _HUMAN_INPUT_KINDS and session_id and not _is_routine_run(kwargs):
        _raise_from_hook("resolved", session_id, kwargs.get("request_id"))


# Long replies

@_observer
def on_pre_llm_call(**kwargs) -> None:
    """Note when a reply starts, so its end can tell how long it ran.

    Turns of a delegated subagent carry their parent's session id and are not timed: their chat is
    not one the apps show, and the parent's own reply raises ``finished``.
    """
    turn_id = kwargs.get("turn_id")
    if turn_id and not kwargs.get("parent_session_id") and not _is_routine_run(kwargs):
        _remember_turn_start(turn_id, time.time())


@_observer
def on_session_end(**kwargs) -> None:
    """Raise ``finished`` when a completed reply ran for at least ``FINISHED_AFTER_S``."""
    turn_id = kwargs.get("turn_id")
    session_id = kwargs.get("session_id")
    if not turn_id or not session_id or _is_routine_run(kwargs):
        return
    started = _forget_turn_start(turn_id)
    if started is not None and kwargs.get("completed") and time.time() - started >= FINISHED_AFTER_S:
        _raise_from_hook("finished", session_id, turn_id)


def _remember_turn_start(turn_id: str, now: float) -> None:
    """Keep the first start time of each turn; drop stale entries so the map stays small."""
    with _turn_lock:
        _turn_starts.setdefault(turn_id, now)
        if len(_turn_starts) > _TURN_START_CAP:
            for key in [k for k, started in _turn_starts.items() if now - started > _TURN_START_MAX_AGE_S]:
                del _turn_starts[key]


def _forget_turn_start(turn_id: str) -> Optional[float]:
    """Remove a turn's start time and return it; None when it was never noted."""
    with _turn_lock:
        return _turn_starts.pop(turn_id, None)


# Hermes hook name for each handler
HOOKS = {
    "on_human_input_request": on_human_input_request,
    "on_human_input_resolved": on_human_input_resolved,
    "pre_llm_call": on_pre_llm_call,
    "on_session_end": on_session_end,
}

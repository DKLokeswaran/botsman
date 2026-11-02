"""Routine delivery: queue output from cron, then write it into the chat under the chat's turn lease.

Queuing returns at once, so a Run now send never outlasts Hermes's 60 s standalone-send limit. A
background worker in each long-lived process that loads the plugin writes the queued rows. It holds
the chat's cross-process turn lease while it writes, so a row never lands in the middle of a reply.
Each message is written with the row's own message id, so a retry after an interrupted write finds
the earlier write instead of writing the message twice.
"""

from __future__ import annotations

import logging
import os
import sqlite3
import threading
import time
import uuid
from pathlib import Path
from typing import Optional

from . import alerts, store
from .routine_output import extract_output, parse_target, routine_message

logger = logging.getLogger(__name__)

IDLE_POLL_S = 1.0
LEASE_RETRY_S = 2.0
LEASE_TTL_S = 30.0
BUSY_LIMIT_S = 15 * 60.0
BUSY_GAP_S = 60.0
MAX_ATTEMPTS = 5
PRUNE_EVERY_S = 3600.0

WORKER_ID = f"hermes-bots:pid={os.getpid()}:{uuid.uuid4().hex[:8]}"
_worker_lock = threading.Lock()
_worker: Optional[threading.Thread] = None


class ChatNotFound(Exception):
    """The target chat does not exist in the bot's session database."""


# Queue

def queue_routine_output(chat_id: str, content: str) -> int:
    """Queue cron output for the chat named in ``chat_id`` and make sure a worker will write it."""
    session_id, routine = parse_target(chat_id)
    output, failed = extract_output(content)
    row_id = store.enqueue_delivery(
        bot=alerts.active_bot(), db_path=str(_active_db_path()), session_id=session_id, routine=routine,
        text=routine_message(routine, output), failed=failed, message_uid=uuid.uuid4().hex)
    ensure_worker_running()
    return row_id


def _active_db_path() -> Path:
    """The session database of the bot whose routine is delivering."""
    from hermes_constants import get_hermes_home
    return get_hermes_home() / "state.db"


# Worker

def ensure_worker_running() -> None:
    """Start this process's delivery worker once."""
    global _worker
    with _worker_lock:
        if _worker is not None and _worker.is_alive():
            return
        _worker = threading.Thread(target=_run_worker, name="hermes-bots-delivery", daemon=True)
        _worker.start()


def _run_worker() -> None:
    """Write queued rows for the life of the process; an error never stops the loop."""
    last_prune = 0.0
    while True:
        try:
            # Clear out old alerts and finished rows once an hour
            if time.time() - last_prune > PRUNE_EVERY_S:
                store.prune()
                last_prune = time.time()
            # Write the next due row, or wait when there is none
            if not process_next():
                time.sleep(IDLE_POLL_S)
        except Exception:
            logger.exception("hermes-bots delivery worker error")
            time.sleep(IDLE_POLL_S)


def process_next() -> bool:
    """Try to write the next due row. Returns False when nothing was due."""
    row = store.claim_next_delivery(WORKER_ID)
    if row is None:
        return False
    try:
        message_id = write_under_lease(row)
    except ChatNotFound as exc:
        _drop(row, str(exc))
    except Exception as exc:
        _retry_or_drop(row, f"{type(exc).__name__}: {exc}")
    else:
        _after_attempt(row, message_id)
    return True


def _after_attempt(row: dict, message_id: Optional[int]) -> None:
    """Record a write, or wait for the running reply until the chat has been busy for the busy limit."""
    if message_id is not None:
        store.finish_delivery(row["id"], WORKER_ID, state="written", message_id=message_id)
        alerts.raise_alert(row["bot"], "routine_failed" if row["failed"] else "routine", row["session_id"])
        return
    now = time.time()
    busy_since = _busy_stretch_start(row, now)
    if now - busy_since > BUSY_LIMIT_S:
        _drop(row, "the chat stayed busy for 15 minutes")
    else:
        store.defer_delivery(row["id"], WORKER_ID, retry_at=now + LEASE_RETRY_S, busy_since=busy_since)


def _busy_stretch_start(row: dict, now: float) -> float:
    """When the chat's current busy stretch began; a stretch ends when checks stopped for over BUSY_GAP_S."""
    checked_without_gap = now - row["next_attempt_at"] <= BUSY_GAP_S
    if row["busy_since"] is not None and checked_without_gap:
        return row["busy_since"]
    return now


def _retry_or_drop(row: dict, error: str) -> None:
    """Back off after an unexpected error; give up after MAX_ATTEMPTS."""
    logger.warning("hermes-bots delivery %s failed: %s", row["id"], error)
    if row["attempts"] + 1 >= MAX_ATTEMPTS:
        _drop(row, error)
        return
    backoff = LEASE_RETRY_S * (2 ** row["attempts"])
    store.defer_delivery(row["id"], WORKER_ID, retry_at=time.time() + backoff, error=error, count_attempt=True)


def _drop(row: dict, error: str) -> None:
    """Give up on a row; the user still hears that the routine did not arrive."""
    logger.warning("hermes-bots dropped delivery %s: %s", row["id"], error)
    store.finish_delivery(row["id"], WORKER_ID, state="dropped", error=error)
    alerts.raise_alert(row["bot"], "routine_failed", row["session_id"])


# Chat write

def write_under_lease(row: dict) -> Optional[int]:
    """Write the row's message as the bot's when no reply holds the chat. None means the chat is busy."""
    from hermes_state_registry import acquire, release_or_close
    db = acquire(Path(row["db_path"]))
    try:
        target = _chat_tip(db, row["session_id"])
        # Take the chat's turn lease; a running reply holds it
        holder = f"{WORKER_ID}:{uuid.uuid4().hex[:8]}"
        if not db.try_acquire_session_turn_lease(target, holder, ttl_seconds=LEASE_TTL_S):
            return None
        try:
            return _write_once(db, target, holder, row)
        finally:
            _release_lease(db, target, holder)
    finally:
        release_or_close(db)


def _chat_tip(db, session_id: str) -> str:
    """The chat's latest continuation, which takes new messages."""
    if db.get_session(session_id) is None:
        raise ChatNotFound(f"chat {session_id} not found")
    return db.resolve_resume_session_id(session_id) or session_id


def _write_once(db, target: str, holder: str, row: dict) -> int:
    """Append the message, unless an earlier attempt already did; returns its message id."""
    # An attempt that got as far as writing may have landed before its process stopped
    if row["write_started"]:
        earlier = _find_message(row["db_path"], row["message_uid"])
        if earlier is not None:
            return earlier
    store.mark_write_started(row["id"], WORKER_ID)
    return int(db.append_message(target, "assistant", row["text"], turn_lease_holder=holder,
                                 message_uid=row["message_uid"]))


def _find_message(db_path: str, message_uid: str) -> Optional[int]:
    """The id of the message written with ``message_uid``, read straight from the bot's session database.

    The id is random and unique, so it identifies the message in any session of the chat's lineage.
    """
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True, timeout=15)
    try:
        row = conn.execute("SELECT id FROM messages WHERE message_uid = ? LIMIT 1", (message_uid,)).fetchone()
    finally:
        conn.close()
    return int(row[0]) if row else None


def _release_lease(db, target: str, holder: str) -> None:
    """Hand the lease back. A failure is only logged: the write stands, and the lease's TTL frees it."""
    try:
        db.release_session_turn_lease(target, holder)
    except Exception as exc:
        logger.warning("hermes-bots could not release the turn lease on %s: %s", target, exc)

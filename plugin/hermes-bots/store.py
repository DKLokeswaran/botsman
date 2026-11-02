"""Shared SQLite store at the Hermes root: the routine delivery queue and the alert log.

Every profile's copy of the plugin, in every Hermes process, uses this one file, so the
launch profile's dashboard can stream alerts for every bot. This module imports nothing
from the plugin package, because the dashboard routes load it by file path.
"""

from __future__ import annotations

import contextlib
import functools
import logging
import sqlite3
import threading
import time
from pathlib import Path
from typing import Iterator, Optional

logger = logging.getLogger(__name__)

SCHEMA_VERSION = 1
STORE_FILE = "hermes-bots.db"
CLAIM_TIMEOUT_S = 300.0
RETENTION_S = 7 * 24 * 3600.0

_SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at REAL NOT NULL,
    bot TEXT NOT NULL,
    db_path TEXT NOT NULL,
    session_id TEXT NOT NULL,
    routine TEXT NOT NULL,
    text TEXT NOT NULL,
    failed INTEGER NOT NULL,
    message_uid TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'pending',
    next_attempt_at REAL NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    claimed_by TEXT,
    claimed_at REAL,
    busy_since REAL,
    write_started INTEGER NOT NULL DEFAULT 0,
    message_id INTEGER,
    error TEXT,
    finished_at REAL
);
CREATE INDEX IF NOT EXISTS deliveries_pending ON deliveries (state, id);
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts REAL NOT NULL,
    bot TEXT NOT NULL,
    kind TEXT NOT NULL,
    session_id TEXT NOT NULL,
    ref TEXT
);
"""

# The oldest pending row of each chat that no live worker holds, so rows land in order per chat
_CLAIMABLE_SQL = """
SELECT * FROM deliveries AS d
WHERE d.state = 'pending' AND d.next_attempt_at <= :now
  AND (d.claimed_by IS NULL OR d.claimed_at < :stale)
  AND NOT EXISTS (
      SELECT 1 FROM deliveries AS e
      WHERE e.state = 'pending' AND e.db_path = d.db_path AND e.session_id = d.session_id AND e.id < d.id)
ORDER BY d.id LIMIT 1
"""

_prepared_paths: set[str] = set()
_prepare_lock = threading.Lock()


def store_path() -> Path:
    """The store file under the Hermes root, shared by every profile."""
    from hermes_constants import get_default_hermes_root
    return get_default_hermes_root() / "plugin-data" / "hermes-bots" / STORE_FILE


@contextlib.contextmanager
def open_store(path: Optional[Path] = None) -> Iterator[sqlite3.Connection]:
    """A connection in autocommit mode with the schema in place; closed on exit."""
    # Open the file, creating its folder on first use
    path = path or store_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=15, isolation_level=None)
    conn.row_factory = sqlite3.Row
    try:
        _prepare_once(conn, path)
        yield conn
    finally:
        conn.close()


def _prepare_once(conn: sqlite3.Connection, path: Path) -> None:
    """Set up the file once per process, so later opens, reads included, take no write lock."""
    with _prepare_lock:
        if str(path) in _prepared_paths:
            return
        # WAL lets readers run while another process writes; create the tables if missing
        conn.execute("PRAGMA journal_mode=WAL")
        conn.executescript(_SCHEMA)
        conn.execute("INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', ?)", (str(SCHEMA_VERSION),))
        _prepared_paths.add(str(path))


def _holder_is_dead(worker_id: str) -> bool:
    """Whether a worker's process is provably gone, judged the way Hermes judges its own lease holders.

    Hermes's probe is safe on Windows and in other PID namespaces, and answers "not dead" whenever it
    is unsure. Without the probe no worker counts as dead, so its claims wait for the claim timeout.
    """
    probe = _hermes_holder_probe()
    return probe is not None and probe(worker_id)


@functools.lru_cache(maxsize=1)
def _hermes_holder_probe():
    """Hermes's dead-holder probe, or None with one warning when this Hermes does not have it."""
    try:
        from hermes_state import _compression_lock_holder_process_is_dead
    except ImportError:
        logger.warning("hermes-bots: Hermes's lease-holder probe is unavailable; dead workers' claims wait"
                       " for the claim timeout")
        return None
    return _compression_lock_holder_process_is_dead


@contextlib.contextmanager
def _write(conn: sqlite3.Connection) -> Iterator[sqlite3.Connection]:
    """One write transaction that takes the lock up front, so claims never race."""
    conn.execute("BEGIN IMMEDIATE")
    try:
        yield conn
    except BaseException:
        conn.execute("ROLLBACK")
        raise
    conn.execute("COMMIT")


# Delivery queue

def enqueue_delivery(*, bot: str, db_path: str, session_id: str, routine: str, text: str, failed: bool,
                     message_uid: str, path: Optional[Path] = None) -> int:
    """Queue one routine message for the delivery worker; returns its row id.

    ``message_uid`` is the id the chat message is written with, so a retry can find an earlier write.
    """
    now = time.time()
    with open_store(path) as conn:
        cursor = conn.execute(
            "INSERT INTO deliveries (created_at, bot, db_path, session_id, routine, text, failed, message_uid,"
            " next_attempt_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (now, bot, db_path, session_id, routine, text, int(failed), message_uid, now))
        return int(cursor.lastrowid)


def claim_next_delivery(worker_id: str, path: Optional[Path] = None) -> Optional[dict]:
    """Claim the next row that is due, or return None when there is nothing to do."""
    now = time.time()
    with open_store(path) as conn, _write(conn):
        _release_dead_claims(conn)
        row = conn.execute(_CLAIMABLE_SQL, {"now": now, "stale": now - CLAIM_TIMEOUT_S}).fetchone()
        if row is None:
            return None
        conn.execute("UPDATE deliveries SET claimed_by = ?, claimed_at = ? WHERE id = ?", (worker_id, now, row["id"]))
        return dict(row)


def _release_dead_claims(conn: sqlite3.Connection) -> None:
    """Free the rows held by a worker whose process has stopped, without waiting for the claim timeout."""
    holders = conn.execute(
        "SELECT DISTINCT claimed_by FROM deliveries WHERE state = 'pending' AND claimed_by IS NOT NULL").fetchall()
    for (holder,) in holders:
        if _holder_is_dead(holder):
            conn.execute("UPDATE deliveries SET claimed_by = NULL, claimed_at = NULL"
                         " WHERE state = 'pending' AND claimed_by = ?", (holder,))


def defer_delivery(row_id: int, worker_id: str, *, retry_at: float, error: Optional[str] = None,
                   count_attempt: bool = False, busy_since: Optional[float] = None,
                   path: Optional[Path] = None) -> None:
    """Release a claim and make the row due again at ``retry_at``.

    ``busy_since`` is when the chat's current busy stretch began; None means the chat is not busy.
    """
    with open_store(path) as conn:
        conn.execute(
            "UPDATE deliveries SET claimed_by = NULL, claimed_at = NULL, next_attempt_at = ?,"
            " attempts = attempts + ?, error = COALESCE(?, error), busy_since = ?"
            " WHERE id = ? AND claimed_by = ?",
            (retry_at, int(count_attempt), error, busy_since, row_id, worker_id))


def mark_write_started(row_id: int, worker_id: str, path: Optional[Path] = None) -> bool:
    """Record that the chat write is about to happen, so a later retry first checks for it.

    Returns False when the worker no longer holds the row's claim, and must not write.
    """
    with open_store(path) as conn:
        cursor = conn.execute("UPDATE deliveries SET write_started = 1 WHERE id = ? AND claimed_by = ?",
                              (row_id, worker_id))
        return cursor.rowcount == 1


def finish_delivery(row_id: int, worker_id: str, *, state: str, alert_kind: str, message_id: Optional[int] = None,
                    error: Optional[str] = None, path: Optional[Path] = None) -> bool:
    """Close a claimed row as ``written`` or ``dropped`` and raise its alert, in one transaction.

    Returns False, and changes nothing, when the worker no longer holds the row's claim.
    """
    with open_store(path) as conn, _write(conn):
        cursor = conn.execute(
            "UPDATE deliveries SET state = ?, message_id = ?, error = ?, finished_at = ?,"
            " claimed_by = NULL, claimed_at = NULL WHERE id = ? AND claimed_by = ?",
            (state, message_id, error, time.time(), row_id, worker_id))
        if cursor.rowcount != 1:
            return False
        bot, session_id = conn.execute("SELECT bot, session_id FROM deliveries WHERE id = ?", (row_id,)).fetchone()
        _insert_alert(conn, bot, alert_kind, session_id, None)
        return True


def get_delivery(row_id: int, path: Optional[Path] = None) -> Optional[dict]:
    """One queue row by id; None when it does not exist."""
    with open_store(path) as conn:
        row = conn.execute("SELECT * FROM deliveries WHERE id = ?", (row_id,)).fetchone()
        return dict(row) if row else None


# Alert log

def add_alert(*, bot: str, kind: str, session_id: str, ref: Optional[str] = None,
              path: Optional[Path] = None) -> int:
    """Append one alert; returns its id, which only ever increases."""
    with open_store(path) as conn:
        return _insert_alert(conn, bot, kind, session_id, ref)


def _insert_alert(conn: sqlite3.Connection, bot: str, kind: str, session_id: str, ref: Optional[str]) -> int:
    """Insert one alert on an open connection; returns its id."""
    cursor = conn.execute("INSERT INTO alerts (ts, bot, kind, session_id, ref) VALUES (?, ?, ?, ?, ?)",
                          (time.time(), bot, kind, session_id, ref))
    return int(cursor.lastrowid)


def alerts_after(last_id: int, limit: int = 500, path: Optional[Path] = None) -> list[dict]:
    """Alerts with an id above ``last_id``, oldest first."""
    with open_store(path) as conn:
        rows = conn.execute("SELECT id, ts, bot, kind, session_id, ref FROM alerts WHERE id > ? ORDER BY id LIMIT ?",
                            (last_id, limit)).fetchall()
        return [dict(row) for row in rows]


def latest_alert_id(path: Optional[Path] = None) -> int:
    """Highest alert id ever issued, including pruned ones; 0 when there were none."""
    with open_store(path) as conn:
        row = conn.execute("SELECT seq FROM sqlite_sequence WHERE name = 'alerts'").fetchone()
        return int(row["seq"]) if row else 0


# Maintenance

def prune(now: Optional[float] = None, path: Optional[Path] = None) -> None:
    """Drop alerts and finished deliveries older than the retention window."""
    cutoff = (now or time.time()) - RETENTION_S
    with open_store(path) as conn, _write(conn):
        conn.execute("DELETE FROM alerts WHERE ts < ?", (cutoff,))
        conn.execute("DELETE FROM deliveries WHERE state != 'pending' AND finished_at < ?", (cutoff,))

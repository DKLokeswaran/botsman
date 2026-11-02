from pathlib import Path

import hermes_bots
from hermes_bots import store

# The plugin folder, as registered for the ``hermes_bots`` package by tests/conftest.py
PLUGIN_DIR = Path(hermes_bots.__path__[0])


def delivery_row(row_id):
    """One queue row by id, read straight from the store; None when it does not exist."""
    with store.open_store() as conn:
        row = conn.execute("SELECT * FROM deliveries WHERE id = ?", (row_id,)).fetchone()
        return dict(row) if row else None


def all_alerts():
    """Every alert as (bot, kind, session_id, ref), oldest first."""
    return [(row["bot"], row["kind"], row["session_id"], row["ref"]) for row in store.alerts_after(0)]

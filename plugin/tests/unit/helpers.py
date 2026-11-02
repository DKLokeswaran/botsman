from pathlib import Path

from hermes_bots import store

PLUGIN_DIR = Path(__file__).resolve().parents[2] / "hermes-bots"


def all_alerts():
    """Every alert as (bot, kind, session_id, ref), oldest first."""
    return [(row["bot"], row["kind"], row["session_id"], row["ref"]) for row in store.alerts_after(0)]

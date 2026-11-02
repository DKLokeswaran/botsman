"""Delivery targets and the shapes of routine output that cron hands to the ``hbapp`` platform.

A routine delivers to ``hbapp:session-<stored session id>/<routine name>``. The routine name is
percent-encoded, because cron splits a job's targets on commas and the name may contain any text.
"""

from __future__ import annotations

import re
from urllib.parse import quote, unquote

PLATFORM = "hbapp"
SESSION_PREFIX = "session-"
DEFAULT_ROUTINE_NAME = "Routine"

# Cron's wrapper when ``cron.wrap_response`` is true (the default). The footer is missing when a
# scheduled run's output was cut at the gateway's message limit.
_WRAPPED = re.compile(
    r"\ACronjob Response: (?P<name>[^\n]*)\n\(job_id: [^\n]*\)\n-------------\n\n(?P<body>.*?)"
    r"(?:\n\nTo stop or manage this job, send me a new message \(e\.g\. \"stop reminder [^\n]*\"\)\.)?\Z",
    re.DOTALL)
# Every notice Hermes's cron delivers when a run fails, was refused, or a job was paused
_FAILURE = re.compile(
    r"\A(?:⚠️?|⛔) ?Cron(?: job| watchdog| monitor)? '.*?' "
    r"(?:failed:|did not run:|was auto-paused|script failed|source failed)",
    re.DOTALL)


def format_target(session_id: str, routine: str) -> str:
    """The ``deliver`` value that sends a routine's output into the chat with this stored id."""
    return f"{PLATFORM}:{SESSION_PREFIX}{session_id}/{quote(routine, safe='')}"


def parse_target(chat_id: str) -> tuple[str, str]:
    """Split ``session-<id>/<routine>`` into the stored session id and the routine name."""
    session_part, _, routine_part = (chat_id or "").strip().partition("/")
    if not session_part.startswith(SESSION_PREFIX) or len(session_part) == len(SESSION_PREFIX):
        raise ValueError(f"not an hbapp chat target: {chat_id!r}")
    routine = unquote(routine_part).strip() or DEFAULT_ROUTINE_NAME
    return session_part[len(SESSION_PREFIX):], routine


def extract_output(content: str) -> tuple[str, bool]:
    """The routine's own output without cron's wrapper, and whether it reports a failed run."""
    match = _WRAPPED.match(content or "")
    output = match.group("body") if match else (content or "")
    return output, bool(_FAILURE.match(output))


def routine_message(routine: str, output: str) -> str:
    """The chat row the apps show as a routine message."""
    return f"[Routine: {routine}]\n{output}"

#!/usr/bin/env python3
"""Fail if a method the thin clients call is missing from the pinned contract."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONTRACT = ROOT / "gateway-contract.openrpc.json"

# Methods the TypeScript client, the Kotlin client, and the notifier call.
REQUIRED_METHODS = [
    "approval.pending",
    "approval.received",
    "client.capabilities",
    "ping",
    "profiles.list",
    "prompt.submit",
    "session.create",
    "session.active_list",
    "session.activate",
    "session.events.since",
    "session.history",
    "session.list",
    "session.resume",
]

REQUIRED_REQUESTS = ["approval", "clarify"]

# Answered on the WebSocket read thread in tui_gateway/ws.py. It is not an
# OpenRPC method. The Desktop client heartbeats with this name, not `ping`.
TRANSPORT_ONLY = ["gateway.ping"]


def main() -> int:
    doc = json.loads(CONTRACT.read_text(encoding="utf-8"))
    names = {method["name"] for method in doc["methods"]}
    requests = {item["name"] for item in doc["x-server-requests"]}
    missing = [name for name in REQUIRED_METHODS if name not in names]
    missing_req = [name for name in REQUIRED_REQUESTS if name not in requests]
    leaked = [name for name in TRANSPORT_ONLY if name in names]
    if missing or missing_req:
        print("contract check failed", file=sys.stderr)
        if missing:
            print("missing methods:", ", ".join(missing), file=sys.stderr)
        if missing_req:
            print("missing server requests:", ", ".join(missing_req), file=sys.stderr)
        return 1
    print(
        f"contract ok: {len(names)} methods, "
        f"clients use {len(REQUIRED_METHODS)}, "
        f"transport-only {', '.join(TRANSPORT_ONLY)} "
        f"({'present' if leaked else 'absent, as expected'})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

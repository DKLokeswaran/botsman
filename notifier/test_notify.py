#!/usr/bin/env python3
"""Drive the notifier against the in-repo fake gateway."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FAKE = ROOT / "contract" / "fake" / "hermes_fake.py"
NOTIFY = Path(__file__).resolve().parent / "hermes_notify.py"
sys.path.insert(0, str(NOTIFY.parent))
from hermes_notify import build_notify, notify_bytes  # noqa: E402


def check_payload_shape() -> str | None:
    huge = build_notify(
        kind="reply",
        title="Reply finished",
        body="x" * 20000,
        session_id="live-1",
        profile="default",
        message_id="42",
        seq=7,
    )
    raw = notify_bytes(huge)
    if len(raw) > 4096:
        return f"payload is {len(raw)} bytes"
    if huge["message_id"] != "42" or huge["seq"] != 7 or huge["session_id"] != "live-1":
        return f"payload dropped a field: {huge}"
    if "password" in raw.decode("utf-8"):
        return "payload included a password field"
    return None


def main() -> int:
    shape = check_payload_shape()
    if shape:
        print(shape, file=sys.stderr)
        return 1
    fake = subprocess.Popen(
        [sys.executable, str(FAKE), "--port", "0"],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
    )
    assert fake.stdout is not None
    banner = fake.stdout.readline()
    port = int(banner.strip().split()[-1])
    env_dir = tempfile.mkdtemp(prefix="hermes-notify-")
    env_path = Path(env_dir) / "notifier.env"
    env_path.write_text(
        "\n".join(
            [
                f"HERMES_URL=http://127.0.0.1:{port}",
                "HERMES_USERNAME=tester",
                "HERMES_PASSWORD=tester",
                "HERMES_PROVIDER=basic",
                "NOTIFY_URL=http://127.0.0.1:9/unused",
                "BIND_HOST=127.0.0.1",
                "BIND_PORT=0",
                "POLL_SECONDS=1",
                "",
            ]
        ),
        encoding="utf-8",
    )
    proc = subprocess.Popen(
        [
            sys.executable,
            str(NOTIFY),
            "--env-file",
            str(env_path),
            "--dry-run",
            "--bind",
            "127.0.0.1",
            "--port",
            "0",
            "--poll-seconds",
            "1",
            "--once-events",
            "2",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        assert proc.stdout is not None
        assert proc.stderr is not None
        stdout_lines: list[str] = []
        stderr_lines: list[str] = []

        def _collect(stream, sink: list[str]) -> None:
            for line in stream:
                sink.append(line)

        threading.Thread(target=_collect, args=(proc.stdout, stdout_lines), daemon=True).start()
        threading.Thread(target=_collect, args=(proc.stderr, stderr_lines), daemon=True).start()
        notes = []
        seen = 0
        deadline = time.time() + 20
        while time.time() < deadline and len(notes) < 2:
            while seen < len(stdout_lines):
                line = stdout_lines[seen]
                seen += 1
                if line.startswith("NOTIFY "):
                    notes.append(json.loads(line[len("NOTIFY ") :]))
            if proc.poll() is not None:
                time.sleep(0.2)
                if seen >= len(stdout_lines):
                    break
                continue
            time.sleep(0.05)
        kinds = {item["kind"] for item in notes}
        if kinds != {"approval", "reply"}:
            err = "".join(stderr_lines)
            print("unexpected notifications", notes, err, file=sys.stderr)
            return 1
        approval = next(item for item in notes if item["kind"] == "approval")
        reply = next(item for item in notes if item["kind"] == "reply")
        if approval.get("session_id") != "live-1" or approval.get("request_id") != "req-1":
            print("approval route missing", approval, file=sys.stderr)
            return 1
        if reply.get("session_id") != "live-1" or not isinstance(reply.get("seq"), int):
            print("reply route missing", reply, file=sys.stderr)
            return 1
        if reply.get("profile") != "default":
            print("reply profile missing", reply, file=sys.stderr)
            return 1
        for item in notes:
            encoded = json.dumps(item, separators=(",", ":")).encode("utf-8")
            if len(encoded) > 4096:
                print("notification exceeds 4 KB", item["kind"], file=sys.stderr)
                return 1
        # The password must not appear in the child's output.
        blob = json.dumps(notes)
        if "tester" in blob and "password" in blob.lower():
            print("notifier output looks like it leaked a secret", file=sys.stderr)
            return 1
        print("notifier ok", ",".join(sorted(kinds)))
        return 0
    finally:
        proc.kill()
        fake.kill()
        try:
            os.remove(env_path)
        except OSError:
            pass


if __name__ == "__main__":
    raise SystemExit(main())

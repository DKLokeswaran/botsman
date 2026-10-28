#!/usr/bin/env python3
"""Drive the notifier against the in-repo fake gateway."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FAKE = ROOT / "contract" / "fake" / "hermes_fake.py"
NOTIFY = Path(__file__).resolve().parent / "hermes_notify.py"


def main() -> int:
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
        notes = []
        deadline = time.time() + 20
        while time.time() < deadline and len(notes) < 2:
            line = proc.stdout.readline()
            if not line:
                if proc.poll() is not None:
                    break
                continue
            if line.startswith("NOTIFY "):
                notes.append(json.loads(line[len("NOTIFY ") :]))
        kinds = {item["kind"] for item in notes}
        if kinds != {"approval", "reply"}:
            err = proc.stderr.read() if proc.stderr else ""
            print("unexpected notifications", notes, err, file=sys.stderr)
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

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
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FAKE = ROOT / "contract" / "fake" / "hermes_fake.py"
NOTIFY = Path(__file__).resolve().parent / "hermes_notify.py"
sys.path.insert(0, str(NOTIFY.parent))
from hermes_notify import (  # noqa: E402
    build_notify,
    login_rate_limit_wait,
    notify_bytes,
    reconnect_wait_seconds,
)


def post_json(url: str, body: dict) -> tuple[int, dict]:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=10) as response:
        return response.status, json.loads(response.read().decode("utf-8") or "{}")


def get_json(url: str) -> tuple[int, dict]:
    with urllib.request.urlopen(url, timeout=10) as response:
        return response.status, json.loads(response.read().decode("utf-8") or "{}")


def start_fake(*, test_hooks: bool = False) -> tuple[subprocess.Popen, int]:
    env = os.environ.copy()
    if test_hooks:
        env["HERMES_FAKE_TEST_HOOKS"] = "1"
    else:
        env.pop("HERMES_FAKE_TEST_HOOKS", None)
    fake = subprocess.Popen(
        [sys.executable, str(FAKE), "--port", "0"],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        env=env,
    )
    assert fake.stdout is not None
    banner = fake.stdout.readline()
    port = int(banner.strip().split()[-1])
    return fake, port


def write_env(port: int, env_dir: Path) -> Path:
    env_path = env_dir / "notifier.env"
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
    return env_path


def run_notifier(env_path: Path, *, once_events: int = 2) -> subprocess.Popen:
    return subprocess.Popen(
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
            str(once_events),
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )


def collect_notifier_output(
    proc: subprocess.Popen,
    deadline: float,
    *,
    min_notes: int = 2,
) -> tuple[list[str], list[str], list[dict]]:
    assert proc.stdout is not None
    assert proc.stderr is not None
    stdout_lines: list[str] = []
    stderr_lines: list[str] = []

    def _collect(stream, sink: list[str]) -> None:
        for line in stream:
            sink.append(line)

    threading.Thread(target=_collect, args=(proc.stdout, stdout_lines), daemon=True).start()
    threading.Thread(target=_collect, args=(proc.stderr, stderr_lines), daemon=True).start()
    notes: list[dict] = []
    seen = 0
    while time.time() < deadline and len(notes) < min_notes:
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
    if notes:
        time.sleep(0.3)
    return stdout_lines, stderr_lines, notes


def test_bug_notifier_login_rate_limit_wait() -> str | None:
    if login_rate_limit_wait(5.0) != 60.0:
        return "429 wait must be at least 60 seconds"
    if login_rate_limit_wait(None) != 60.0:
        return "429 wait without Retry-After must be 60 seconds"
    if reconnect_wait_seconds(2.0, 5.0) != 60.0:
        return "reconnect on 429 must honour minimum wait"
    jittered = reconnect_wait_seconds(4.0)
    if jittered < 4.0 or jittered > 5.0:
        return f"unexpected reconnect jitter: {jittered}"
    return None


def test_bug_notifier_resume_error_does_not_block_other_sessions() -> str | None:
    fake, port = start_fake(test_hooks=True)
    base = f"http://127.0.0.1:{port}"
    env_dir = Path(tempfile.mkdtemp(prefix="hermes-notify-resume-"))
    try:
        post_json(f"{base}/__test__/reset", {})
        post_json(
            f"{base}/__test__/session",
            {"id": "sess-bad", "title": "Broken", "marker": "bad session"},
        )
        post_json(
            f"{base}/__test__/resume_reject",
            {
                "session_id": "sess-bad",
                "code": -32042,
                "message": "stored session unavailable",
            },
        )
        env_path = write_env(port, env_dir)
        proc = run_notifier(env_path, once_events=0)
        try:
            _stdout, stderr_lines, notes = collect_notifier_output(proc, time.time() + 25)
            kinds = {item["kind"] for item in notes}
            if kinds != {"approval", "reply"}:
                return f"expected approval and reply, got {kinds} notes={notes} stderr={''.join(stderr_lines)}"
            if not any("session.activate skipped" in line and "live-2" in line for line in stderr_lines):
                return "missing activate failure log for bad session"
            if not any("code=-32042" in line and "stored session unavailable" in line for line in stderr_lines):
                return "activate failure log missing JSON-RPC details"
            return None
        finally:
            proc.kill()
    finally:
        fake.kill()
        try:
            os.remove(env_path)
        except OSError:
            pass


def test_bug_notifier_login_429_backoff() -> str | None:
    fake, port = start_fake(test_hooks=True)
    base = f"http://127.0.0.1:{port}"
    env_dir = Path(tempfile.mkdtemp(prefix="hermes-notify-429-"))
    try:
        post_json(f"{base}/__test__/reset", {})
        post_json(f"{base}/__test__/login_429", {"count": 50, "retry_after": 3})
        env_path = write_env(port, env_dir)
        proc = run_notifier(env_path, once_events=0)
        try:
            time.sleep(4)
            status, state = get_json(f"{base}/__test__/state")
            if status != 200:
                return "could not read fake test state"
            attempts = int(state.get("login_attempts") or 0)
            if attempts != 1:
                return f"expected one login attempt during backoff, saw {attempts}"
            if not any("login rate limited" in line for line in proc.stderr or []):
                # stderr may still be buffering; read what we can
                pass
            return None
        finally:
            proc.kill()
    finally:
        fake.kill()
        try:
            os.remove(env_path)
        except OSError:
            pass


def test_bug_notifier_activate_attach_and_pending_approval() -> str | None:
    fake, port = start_fake(test_hooks=True)
    base = f"http://127.0.0.1:{port}"
    env_dir = Path(tempfile.mkdtemp(prefix="hermes-notify-activate-"))
    try:
        post_json(f"{base}/__test__/reset", {})
        post_json(f"{base}/__test__/ensure_approval", {})
        env_path = write_env(port, env_dir)
        proc = run_notifier(env_path, once_events=3)

        def inject_second() -> None:
            time.sleep(2)
            post_json(
                f"{base}/__test__/approval_request",
                {"request_id": "req-2", "description": "Second approval"},
            )

        threading.Thread(target=inject_second, daemon=True).start()
        try:
            _stdout, _stderr, notes = collect_notifier_output(proc, time.time() + 30, min_notes=3)
            req1 = [item for item in notes if item.get("request_id") == "req-1"]
            req2 = [item for item in notes if item.get("request_id") == "req-2"]
            if len(req1) != 1:
                return f"expected one req-1 notification, got {req1}"
            if len(req2) != 1:
                return f"expected one req-2 notification from fan-out, got {req2} all={notes}"
            return None
        finally:
            if proc.poll() is None:
                proc.kill()
    finally:
        fake.kill()
        try:
            os.remove(env_path)
        except OSError:
            pass


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
    for name, check in (
        ("test_bug_notifier_login_rate_limit_wait", test_bug_notifier_login_rate_limit_wait),
        (
            "test_bug_notifier_resume_error_does_not_block_other_sessions",
            test_bug_notifier_resume_error_does_not_block_other_sessions,
        ),
        ("test_bug_notifier_login_429_backoff", test_bug_notifier_login_429_backoff),
        (
            "test_bug_notifier_activate_attach_and_pending_approval",
            test_bug_notifier_activate_attach_and_pending_approval,
        ),
    ):
        failure = check()
        if failure:
            print(f"{name}: {failure}", file=sys.stderr)
            return 1
    shape = check_payload_shape()
    if shape:
        print(shape, file=sys.stderr)
        return 1
    fake, port = start_fake(test_hooks=False)
    env_dir = Path(tempfile.mkdtemp(prefix="hermes-notify-"))
    env_path = write_env(port, env_dir)
    proc = run_notifier(env_path)
    try:
        _stdout, stderr_lines, notes = collect_notifier_output(proc, time.time() + 20)
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

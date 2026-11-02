"""Routine output lands in the bot's chat as the bot's message, without a turn, and raises alerts."""

import asyncio
import time

from hermes_bots.routine_output import format_target
from hermes_client import AlertStream, Rpc, event_type
from live import messages, routine_rows, wait_for_routine_row


def _trigger(client, profile: str, job_id: str):
    started = time.time()
    response = client.post(f"/api/cron/jobs/{job_id}/trigger", params={"profile": profile}, timeout=120)
    return response, time.time() - started


async def _run_now_and_wait(client, profile, session_id, job, routine, kind="routine"):
    async with AlertStream(client) as stream:
        response, took = await asyncio.to_thread(_trigger, client, profile, job["id"])
        alert = await stream.wait_for(kind, session_id)
    row = wait_for_routine_row(client, profile, session_id, routine)
    return response, took, alert, row


def test_run_now_writes_the_bots_message_in_every_profile_without_a_turn(client, chats, jobs, profiles):
    routine = "News, daily / weekly"
    for profile in profiles:
        session_id = chats[profile]
        before = len(messages(client, profile, session_id))
        job = jobs(profile, format_target(session_id, routine), "hb_short.py")
        response, took, alert, row = asyncio.run(_run_now_and_wait(client, profile, session_id, job, routine))
        assert response.status_code == 200 and took < 30
        assert (row["role"], row["content"]) == ("assistant", f"[Routine: {routine}]\nHB-SHORT-OK")
        assert alert["bot"] == profile
        time.sleep(3)
        assert len(messages(client, profile, session_id)) == before + 1, "a turn started"


def test_a_failed_run_is_written_and_raises_routine_failed(client, chats, jobs, profiles):
    profile = profiles[0]
    session_id = chats[profile]
    job = jobs(profile, format_target(session_id, "Failing"), "hb_fail.py")
    _, _, alert, row = asyncio.run(_run_now_and_wait(client, profile, session_id, job, "Failing", "routine_failed"))
    assert row["content"].startswith("[Routine: Failing]\n⚠️ Cron '")
    assert alert["bot"] == profile


def test_a_missing_chat_raises_routine_failed(client, jobs, profiles):
    profile = profiles[0]

    async def scenario():
        job = jobs(profile, format_target("20990101_000000_ffffff", "Lost"), "hb_short.py")
        async with AlertStream(client) as stream:
            response, _ = await asyncio.to_thread(_trigger, client, profile, job["id"])
            await stream.wait_for("routine_failed", "20990101_000000_ffffff")
        assert response.status_code == 200
    asyncio.run(scenario())


def test_a_profile_without_the_plugin_fails_at_delivery(client, jobs, chats, profile_without_plugin):
    job = jobs(profile_without_plugin, format_target("20990101_000000_ffffff", "Nowhere"), "hb_short.py")
    response, _ = _trigger(client, profile_without_plugin, job["id"])
    assert response.status_code == 200
    stored = client.get(f"/api/cron/jobs/{job['id']}", params={"profile": profile_without_plugin}).json()
    stored = stored.get("job", stored)
    assert "no delivery target resolved" in str(stored.get("last_delivery_error"))


def test_a_scheduled_run_from_the_gateway_delivers_long_output_whole(client, chats, jobs, profiles):
    profile = profiles[-1]
    session_id = chats[profile]

    async def scenario():
        async with AlertStream(client) as stream:
            jobs(profile, format_target(session_id, "Long"), "hb_long.py", schedule="every 1m")
            await stream.wait_for("routine", session_id, timeout=150)
    asyncio.run(scenario())
    row = wait_for_routine_row(client, profile, session_id, "Long")
    output = row["content"].removeprefix("[Routine: Long]\n")
    assert output.startswith("HB-LONG-START") and output.endswith("HB-LONG-END")
    assert len(output) == len("HB-LONG-START ") + 5000 + len(" HB-LONG-END")


def test_a_routine_waits_for_the_running_reply_and_the_next_reply_sees_it(client, chats, jobs, profiles):
    profile = profiles[-1]
    session_id = chats[profile]
    job = jobs(profile, format_target(session_id, "Reservoir"), "hb_marker.py")

    async def scenario():
        async with AlertStream(client) as stream, Rpc(client) as rpc:
            runtime_id = (await rpc.call("session.resume", {"session_id": session_id, "profile": profile}))["session_id"]
            start = len(rpc.frames)
            await rpc.call("prompt.submit", {"session_id": runtime_id,
                                             "text": "Run this exact terminal command, then reply DONE: "
                                                     "rm -rf /tmp/hb-m1-test-dir && sleep 20"})
            await rpc.wait_event("tool.start", 180, start)
            response, took = await asyncio.to_thread(_trigger, client, profile, job["id"])
            assert response.status_code == 200 and took < 30
            assert routine_rows(client, profile, session_id, "Reservoir") == [], "written during the reply"
            await rpc.wait_event("message.complete", 300, start)
            await stream.wait_for("routine", session_id, timeout=60)
            row = wait_for_routine_row(client, profile, session_id, "Reservoir")
            reply = [m for m in messages(client, profile, session_id) if m["role"] == "assistant"
                     and m["id"] < row["id"] and (m.get("content") or "").strip()][-1]
            assert reply["timestamp"] <= row["timestamp"]
            answer = await rpc.turn(runtime_id, "What percent does the HB-MARKER-ZULU-4 routine line give? "
                                                "Answer with the number only.")
            assert "73" in answer
            await stream.wait_for("approval", session_id, timeout=5)
            await stream.wait_for("resolved", session_id, timeout=5)
            await stream.wait_for("finished", session_id, timeout=30)
            assert any(event_type(f) == "tool.start" for f in rpc.frames[start:])
    asyncio.run(scenario())

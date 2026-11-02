"""Hook alerts come only from the bot's app chat and its subagents; the bot's other chats raise none."""

import asyncio

from hermes_client import AlertStream, Rpc

HOOK_KINDS = {"approval", "question", "resolved", "finished", "error"}


def test_an_approval_in_another_chat_of_the_bot_raises_no_alert(client, chats, profiles):
    profile = profiles[0]

    async def scenario():
        async with AlertStream(client) as stream, Rpc(client) as rpc:
            other = await rpc.call("session.create", {"profile": profile, "title": "hb-test-other"})
            await rpc.turn(other["session_id"], "Run this exact terminal command, then reply DONE: "
                                                "rm -rf /tmp/hb-m1-other-chat-dir && sleep 8")
            await asyncio.sleep(3)
            return [alert for alert in stream.alerts if alert["bot"] == profile and alert["kind"] in HOOK_KINDS]
    assert asyncio.run(scenario()) == []


def test_an_approval_asked_by_a_subagent_of_the_app_chat_raises_an_alert_for_the_chat(client, chats, profiles):
    profile = profiles[0]
    chat_id = chats[profile]

    async def scenario():
        async with AlertStream(client) as stream, Rpc(client) as rpc:
            runtime_id = (await rpc.call("session.resume", {"session_id": chat_id, "profile": profile}))["session_id"]
            await rpc.turn(runtime_id, "Use the delegate_task tool to give a subagent this task: run exactly the "
                                       "terminal command `rm -rf /tmp/hb-m1-subagent-dir` and report the result. "
                                       "Do not run it yourself. Then reply DONE.", timeout=300)
            return await stream.wait_for("approval", chat_id, timeout=30)
    assert asyncio.run(scenario())["bot"] == profile

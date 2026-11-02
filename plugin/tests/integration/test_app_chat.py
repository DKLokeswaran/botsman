"""Hook alerts come only from the bot's app chat; the bot's other chats raise none."""

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

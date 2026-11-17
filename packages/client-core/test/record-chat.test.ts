import { writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { chatStream } from "@botsman/protocol";
import { scriptSwitches } from "@botsman/server/src/testing/script-model.ts";
import { describe, expect, it } from "vitest";
import type { ChatState, StreamMessage } from "../src/index.ts";
import { startRig, until } from "./real-server.ts";

const FIXTURE = new URL("./fixtures/chat-recording.json", import.meta.url);
const replied = (text: string) => (state: ChatState) => state.messages.some((message) => message.type === "assistant" && message.text.includes(text)) && !state.live.running;

// Records a chat's stream from the real server into the fixture that recording.test.ts replays. Run it with
// RECORD_CHAT=1 after a change to the stream, then check the replay test's expectations.
describe.skipIf(process.env.RECORD_CHAT !== "1")("record the chat event set", () => {
  it("records a reply, an approval, a failure and retry, and a clear", async () => {
    const rig = await startRig();
    const bot = await rig.client.createBot({ name: "Recorder", defaultModel: { provider: "script", modelId: "script-1" } });
    const recorded: StreamMessage[] = [];
    const stopRecording = rig.client.connection.subscribe(chatStream(bot.id), (message) => recorded.push(message));
    const chat = rig.client.chat(bot.id);
    const unwatch = chat.watch();
    await until(chat.state, (state) => state.status === "ready");

    await chat.send("hello there");
    await until(chat.state, replied("echo: hello there"));

    await chat.send('tool read {"path":"/etc/hostname"}');
    const waiting = await until(rig.client.server, (state) => state.approvals.some((approval) => approval.botId === bot.id));
    await rig.client.answerApproval(waiting.approvals.find((approval) => approval.botId === bot.id)!.id, "allow_once");
    await until(chat.state, replied("tool read returned"));

    scriptSwitches.failing = true;
    await chat.send("fail");
    await until(chat.state, (state) => state.live.failure !== null && !state.live.running);
    scriptSwitches.failing = false;
    await chat.retryReply();
    await until(chat.state, replied("echo: fail"));

    await chat.clear();
    await until(chat.state, (state) => state.messages.some((message) => message.type === "notice" && message.kind === "reset"));

    unwatch();
    stopRecording();
    await rig.stop();
    expect(recorded.length).toBeGreaterThan(10);
    // The machine's name comes back from the tool call; a neutral one keeps the fixture the same everywhere.
    writeFileSync(FIXTURE, `${JSON.stringify(recorded, null, 1).replaceAll(hostname(), "example-host")}\n`);
  });
});

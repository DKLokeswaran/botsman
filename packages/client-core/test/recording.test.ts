import type { ChatEvent, ChatSnapshot } from "@botsman/protocol";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyChatEvent, applyChatSnapshot, type ChatItem, chatItems, type ChatState, emptyChat, type StreamMessage } from "../src/index.ts";

// A chat stream recorded from the real server by record-chat.test.ts: a reply, a tool call that asked for approval,
// a failed reply and its retry, and a clear. Both chat screens draw only what chatItems returns, so this pins what
// they show for the same events.
const recording = JSON.parse(readFileSync(new URL("./fixtures/chat-recording.json", import.meta.url), "utf8")) as StreamMessage[];

function replay(messages: readonly StreamMessage[]): ChatState[] {
  const states: ChatState[] = [];
  let state = emptyChat;
  for (const message of messages) {
    if (message.type === "snapshot") state = applyChatSnapshot(state, message.snapshot as ChatSnapshot);
    if (message.type === "event") state = applyChatEvent(state, message.event as ChatEvent);
    if (message.type === "catchup") state = message.events.reduce((next, item) => applyChatEvent(next, item.event as ChatEvent), state);
    states.push(state);
  }
  return states;
}

// One line per item, with what a screen would show.
function lines(items: ChatItem[]): string[] {
  return items.map((item) => {
    if (item.kind === "reply") return `reply: ${item.text.trim()}${item.tools.map((tool) => ` [${tool.name} ${tool.status}${tool.approvalId === undefined ? "" : " awaiting approval"}]`).join("")}${item.error === null ? "" : ` (error: ${item.error})`}`;
    return `${item.kind}: ${"text" in item ? item.text : ""}`;
  });
}

describe("the recorded chat", () => {
  const states = replay(recording);

  // The failed reply stays in the transcript with its error, and the retry's answer follows it.
  it("ends with every turn in order, tool results inside their reply, and the clear notice last", () => {
    expect(lines(chatItems(states.at(-1)!))).toEqual([
      "user: hello there",
      "reply: echo: hello there",
      'user: tool read {"path":"/etc/hostname"}',
      "reply:  [read done]",
      "reply: tool read returned: example-host",
      "user: fail",
      "reply:  (error: 400 invalid request (scripted failure))",
      "reply: echo: fail",
      "notice: The chat context was cleared",
    ]);
  });

  it("shows the tool call waiting for approval while it waits", () => {
    const waiting = states.map((state) => lines(chatItems(state))).find((items) => items.some((line) => line.includes("awaiting approval")));
    expect(waiting).toBeDefined();
  });

  it("shows the failure until the retry starts", () => {
    const failed = states.findIndex((state) => state.live.failure !== null);
    expect(failed).toBeGreaterThan(0);
    expect(chatItems(states[failed]!).at(-1)?.kind).toBe("failure");
    expect(states.at(-1)!.live.failure).toBeNull();
  });
});

import type { ChatEvent, ChatSnapshot } from "@botsman/protocol";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyChatEvent, applyChatSnapshot, type ChatItem, chatItems, type RunStep, type ChatState, emptyChat, type StreamMessage } from "../src/index.ts";

// A chat stream recorded from the real server by record-chat.test.ts: a reply, a tool call that asked for approval,
// a failed reply and its retry, and a clear. Both chat screens draw only what chatItems returns, so this pins what
// they show for the same events.
const recording = JSON.parse(readFileSync(new URL("./fixtures/chat-recording.json", import.meta.url), "utf8")) as StreamMessage[];

function replay(messages: readonly StreamMessage[]): ChatState[] {
  const states: ChatState[] = [];
  let state = emptyChat;
  for (const message of messages) {
    if (message.type === "snapshot") state = applyChatSnapshot(state, message.snapshot as ChatSnapshot);
    if (message.type === "event") state = applyRecorded(state, message.event as ChatEvent);
    if (message.type === "catchup") for (const item of message.events) state = applyRecorded(state, item.event as ChatEvent);
    states.push(state);
  }
  return states;
}

// A recorded event that doesn't apply fails the test.
function applyRecorded(state: ChatState, event: ChatEvent): ChatState {
  const next = applyChatEvent(state, event);
  if (next === undefined) throw new Error(`recorded event failed its check: ${JSON.stringify(event)}`);
  return next;
}

// One line per item, with what a screen would show.
function lines(items: ChatItem[]): string[] {
  return items.map((item) => {
    if (item.kind === "run") return `run: ${item.steps.map(stepLine).join(" | ")}${item.error === null ? "" : ` (error: ${item.error})`}`;
    return `${item.kind}: ${"text" in item ? item.text : ""}`;
  });
}

function stepLine(step: RunStep): string {
  if (step.kind === "text") return step.text.trim();
  return `[${step.tools.map((tool) => `${tool.name} ${tool.status}${tool.approvalId === undefined ? "" : " awaiting approval"}`).join(", ")}]`;
}

describe("the recorded chat", () => {
  const states = replay(recording);

  // One run per message. The failed attempt is left out once the retry answered, and tool results sit in their call.
  it("ends with one run per message, the retried failure left out, and the clear notice last", () => {
    expect(lines(chatItems(states.at(-1)!))).toEqual([
      "user: hello there",
      "run: echo: hello there",
      'user: tool read {"path":"/etc/hostname"}',
      "run: [read done] | tool read returned: example-host",
      "user: fail",
      "run: echo: fail",
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

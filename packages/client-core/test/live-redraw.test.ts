import type { ChatMessage, LiveState, StreamEvent } from "@botsman/protocol";
import { expect, test } from "vitest";
import { ChatController, emptyChat, fadesIn, LIVE_REDRAW_MS, liveRedrawDelay, type Session, type StreamConnection, type StreamListener } from "../src/index.ts";

const STREAM = "chat:b1";
const live = (streamingText: string): LiveState => ({ ...emptyChat.live, running: true, streamingText });
const reply: ChatMessage = { type: "assistant", id: "2", at: 1, text: "done", thinking: "", toolCalls: [], model: null, usage: null, stopReason: "stop", error: null };

// A chat fed by hand, counting how often its state changes.
function watchedChat() {
  let listener: StreamListener = () => {};
  const connection = { subscribe: (_stream: string, next: StreamListener) => ((listener = next), () => {}) } as unknown as StreamConnection;
  const session = { request: async () => ({ ok: true }) } as unknown as Session;
  const chat = new ChatController("b1", session, connection, () => "r1");
  chat.watch();
  let changes = 0;
  chat.state.subscribe(() => (changes += 1));
  const send = (event: StreamEvent) => listener({ type: "event", stream: STREAM, epoch: "e", seq: 1, event });
  return { chat, send, changes: () => changes };
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("a burst of live updates draws once, with the newest", async () => {
  const { chat, send, changes } = watchedChat();
  for (let words = 1; words <= 20; words += 1) send({ type: "live", live: live("word ".repeat(words)) });
  expect(changes()).toBe(0);
  await pause(LIVE_REDRAW_MS * 2);
  expect(changes()).toBe(1);
  expect(chat.state.get().live.streamingText).toBe("word ".repeat(20));
});

test("a message draws the waiting live state first, so nothing shows out of order", () => {
  const { chat, send, changes } = watchedChat();
  send({ type: "live", live: live("almost") });
  send({ type: "message", message: reply });
  expect(changes()).toBe(2);
  expect(chat.state.get().live.streamingText).toBe("almost");
  expect(chat.state.get().messages).toEqual([reply]);
});

test("a longer reply redraws less often, up to once a second", () => {
  expect(liveRedrawDelay(live(""))).toBe(LIVE_REDRAW_MS);
  expect(liveRedrawDelay(live("x".repeat(10_000)))).toBe(LIVE_REDRAW_MS + 100);
  expect(liveRedrawDelay(live("x".repeat(500_000)))).toBe(1_000);
});

test("only a short streaming reply fades in", () => {
  expect(fadesIn("short", true)).toBe(true);
  expect(fadesIn("short", false)).toBe(false);
  expect(fadesIn("x".repeat(5_000), true)).toBe(false);
});

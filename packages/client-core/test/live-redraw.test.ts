import type { ChatMessage, LiveState, StreamEvent } from "@botsman/protocol";
import { diffLive } from "@botsman/server/src/events/live-diff.ts";
import { expect, test, vi } from "vitest";
import { ChatController, emptyChat, fadesIn, LIVE_REDRAW_MS, liveRedrawDelay, type Session, type StreamConnection, type StreamListener, type StreamMessage } from "../src/index.ts";

const STREAM = "chat:b1";
const live = (streamingText: string): LiveState => ({ ...emptyChat.live, running: true, streamingText });
const reply: ChatMessage = { type: "assistant", id: "2", at: 1, text: "done", thinking: "", toolCalls: [], model: null, usage: null, stopReason: "stop", error: null };

// A chat fed by hand from an idle start, counting how often its state changes and how often it asked to resync.
function watchedChat() {
  let listener: StreamListener = () => {};
  const resync = vi.fn();
  const connection = { subscribe: (_stream: string, next: StreamListener) => ((listener = next), () => {}), resync } as unknown as StreamConnection;
  const session = { request: async () => ({ ok: true }) } as unknown as Session;
  const chat = new ChatController("b1", session, connection, () => "r1");
  chat.watch();
  let changes = 0;
  chat.state.subscribe(() => (changes += 1));
  let shown = emptyChat.live;
  const send = (event: StreamEvent) => listener({ type: "event", stream: STREAM, epoch: "e", seq: 1, event });
  // Sends the patch from the last state sent to this one, as the server does.
  const sendLive = (next: LiveState) => {
    send({ type: "live_patch", patch: diffLive(shown, next) });
    shown = next;
  };
  const deliver = (message: StreamMessage) => listener(message);
  return { chat, send, sendLive, deliver, resync, changes: () => changes };
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("a burst of patches draws once, with all of them folded in", async () => {
  const { chat, sendLive, changes } = watchedChat();
  for (let words = 1; words <= 20; words += 1) sendLive(live("word ".repeat(words)));
  expect(changes()).toBe(0);
  await pause(LIVE_REDRAW_MS * 2);
  expect(changes()).toBe(1);
  expect(chat.state.get().live.streamingText).toBe("word ".repeat(20));
});

test("a burst holding a clear or a sliding window drop folds exactly", async () => {
  const { chat, sendLive } = watchedChat();
  sendLive(live("first reply"));
  sendLive(live(""));
  sendLive({ ...live(""), tools: [{ callId: "c1", name: "bash", status: "running", output: "a\nb\nc\n", awaitingApproval: null }] });
  sendLive({ ...live(""), tools: [{ callId: "c1", name: "bash", status: "running", output: "b\nc\nd\n", awaitingApproval: null }] });
  await pause(LIVE_REDRAW_MS * 2);
  expect(chat.state.get().live.streamingText).toBe("");
  expect(chat.state.get().live.tools[0]!.output).toBe("b\nc\nd\n");
});

test("a message draws the waiting live state first, so nothing shows out of order", () => {
  const { chat, send, sendLive, changes } = watchedChat();
  sendLive(live("almost"));
  send({ type: "message", message: reply });
  expect(changes()).toBe(2);
  expect(chat.state.get().live.streamingText).toBe("almost");
  expect(chat.state.get().messages).toEqual([reply]);
});

test("a patch that fails its check while folding keeps the screen and asks to resync", async () => {
  const { chat, send, resync, changes } = watchedChat();
  send({ type: "live_patch", patch: { streamingText: { drop: 3, append: "x", length: 1, hash: 0 } } });
  await pause(LIVE_REDRAW_MS * 2);
  expect(changes()).toBe(0);
  expect(chat.state.get().live).toEqual(emptyChat.live);
  expect(resync).toHaveBeenCalledWith(STREAM);
});

test("a patch that fails its check inside a mixed catch-up stops there and asks to resync", () => {
  const { chat, deliver, resync } = watchedChat();
  const bad = { type: "live_patch" as const, patch: { streamingText: { drop: 9, append: "", length: 0, hash: 0 } } };
  deliver({ type: "catchup", stream: STREAM, epoch: "e", events: [{ seq: 1, event: bad }, { seq: 2, event: { type: "message", message: reply } }] });
  expect(chat.state.get().messages).toEqual([]);
  expect(resync).toHaveBeenCalledOnce();
});

test("the hash is checked once per field when drawing", async () => {
  const { chat, send, resync } = watchedChat();
  send({ type: "live_patch", patch: { streamingText: { drop: 0, append: "Hello", length: 5, hash: 1 } } });
  await pause(LIVE_REDRAW_MS * 2);
  expect(chat.state.get().live.streamingText).toBe("");
  expect(resync).toHaveBeenCalledOnce();
});

test("an empty catch-up changes nothing", () => {
  const { deliver, changes } = watchedChat();
  deliver({ type: "catchup", stream: STREAM, epoch: "e", events: [] });
  expect(changes()).toBe(0);
});

test("a catch-up after a reconnect folds onto the patches still waiting to be drawn", async () => {
  const { chat, deliver, sendLive } = watchedChat();
  sendLive(live("Hello"));
  const patch = diffLive(live("Hello"), live("Hello, how"));
  deliver({ type: "catchup", stream: STREAM, epoch: "e", events: [{ seq: 2, event: { type: "live_patch", patch } }] });
  await pause(LIVE_REDRAW_MS * 2);
  expect(chat.state.get().live.streamingText).toBe("Hello, how");
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

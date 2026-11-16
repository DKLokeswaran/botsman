import type { Approval, Bot, ChatMessage } from "@botsman/protocol";
import { expect, test } from "vitest";
import { addPending, applyChatEvent, applyHistoryPage, applyServerEvent, defaultSendMode, emptyChat, emptyServerState, offeredSendModes, sortBots } from "../src/index.ts";

const user = (id: string, text: string): ChatMessage => ({ type: "user", id, text });
const bot = (id: string, name: string, isMain = false) => ({ id, name, isMain }) as Bot;
const approval = (id: string, status: Approval["status"], createdAt = 0) => ({ id, botId: "b1", status, createdAt }) as Approval;

test("offers Send while idle, and Queue or Steer while busy or compacting", () => {
  expect(offeredSendModes({ running: false, compacting: false })).toEqual(["send"]);
  expect(offeredSendModes({ running: true, compacting: false })).toEqual(["queue", "steer"]);
  expect(offeredSendModes({ running: false, compacting: true })).toEqual(["queue", "steer"]);
  expect(defaultSendMode({ running: true, compacting: false })).toBe("queue");
});

test("a message that arrives twice is kept once", () => {
  const once = applyChatEvent(emptyChat, { type: "message", message: user("1", "hi") });
  const twice = applyChatEvent(once, { type: "message", message: user("1", "hi") });
  expect(twice.messages).toHaveLength(1);
});

test("two pending sends with the same text settle one at a time", () => {
  const pending = { text: "again", mode: "send" as const, failed: undefined };
  let state = addPending(addPending(emptyChat, { requestId: "a", ...pending }), { requestId: "b", ...pending });
  state = applyChatEvent(state, { type: "message", message: user("1", "again") });
  expect(state.pending.map((send) => send.requestId)).toEqual(["b"]);
  state = applyChatEvent(state, { type: "message", message: user("2", "again") });
  expect(state.pending).toEqual([]);
});

test("a failed send stays until the owner retries or discards it", () => {
  const state = addPending(emptyChat, { requestId: "a", text: "hi", mode: "send", failed: "Couldn't send" });
  expect(applyChatEvent(state, { type: "message", message: user("1", "hi") }).pending).toHaveLength(1);
});

test("an older page goes in front, without repeating a message already shown", () => {
  const shown = applyChatEvent(emptyChat, { type: "message", message: user("5", "new") });
  const state = applyHistoryPage(shown, { messages: [user("4", "old"), user("5", "new")], hasEarlier: false });
  expect(state.messages.map((message) => message.id)).toEqual(["4", "5"]);
  expect(state.hasEarlier).toBe(false);
});

test("the main bot sorts first, then the rest by name", () => {
  expect(sortBots([bot("1", "Nightwatch"), bot("2", "Junior", true), bot("3", "Atlas")]).map((each) => each.name)).toEqual(["Junior", "Atlas", "Nightwatch"]);
});

test("only approvals still waiting are listed, oldest first", () => {
  let state = applyServerEvent(emptyServerState, { type: "approval", approval: approval("b", "pending", 2) });
  state = applyServerEvent(state, { type: "approval", approval: approval("a", "pending", 1) });
  expect(state.approvals.map((each) => each.id)).toEqual(["a", "b"]);
  state = applyServerEvent(state, { type: "approval", approval: approval("a", "allowed", 1) });
  expect(state.approvals.map((each) => each.id)).toEqual(["b"]);
});

test("deleting a bot removes it and its approvals", () => {
  let state = applyServerEvent(emptyServerState, { type: "bot", bot: bot("b1", "Ledger") });
  state = applyServerEvent(state, { type: "approval", approval: approval("a", "pending") });
  state = applyServerEvent(state, { type: "bot_deleted", botId: "b1" });
  expect(state).toMatchObject({ bots: [], approvals: [] });
});

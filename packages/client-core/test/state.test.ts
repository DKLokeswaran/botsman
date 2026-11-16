import type { Approval, Bot, ChatMessage } from "@botsman/protocol";
import { expect, test } from "vitest";
import { addPending, chatItems, formatCost, formatCountdown, formatTokens, toolSummary, applyChatEvent, applyHistoryPage, applyServerEvent, defaultSendMode, emptyChat, emptyServerState, offeredSendModes, sortBots } from "../src/index.ts";

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

test("a tool's result is drawn inside the reply that called it", () => {
  const call = { id: "c1", name: "bash", arguments: { command: "echo   hi" } };
  const reply: ChatMessage = { type: "assistant", id: "2", text: "", thinking: "", toolCalls: [call], model: null, usage: null, stopReason: "toolUse", error: null };
  const result: ChatMessage = { type: "tool_result", id: "3", toolCallId: "c1", toolName: "bash", output: "hi", isError: false };
  const items = chatItems({ ...emptyChat, messages: [user("1", "run it"), reply, result] });
  expect(items.map((item) => item.kind)).toEqual(["user", "reply"]);
  expect(items[1]).toMatchObject({ tools: [{ summary: "bash · echo hi", status: "done", output: "hi" }] });
});

test("the reply being written comes after the settled messages, with a call that waits on the owner", () => {
  const live = { ...emptyChat.live, running: true, streamingText: "Working on it", tools: [{ callId: "c9", name: "read", status: "pending" as const, output: "", awaitingApproval: "a1" }] };
  const items = chatItems({ ...emptyChat, messages: [user("1", "go")], live });
  expect(items.at(-1)).toMatchObject({ kind: "reply", streaming: true, text: "Working on it", tools: [{ status: "waiting", approvalId: "a1" }] });
});

test("queued and pending messages come last", () => {
  const live = { ...emptyChat.live, running: true, streamingText: "…", queued: [{ id: "q1", text: "later", mode: "queue" as const }] };
  const state = addPending({ ...emptyChat, live }, { requestId: "r1", text: "sending", mode: "queue", failed: undefined });
  expect(chatItems(state).map((item) => item.kind)).toEqual(["reply", "queued", "pending"]);
});

test("a tool summary is one short line", () => {
  expect(toolSummary("read", { path: "/etc/hostname" })).toBe("read · /etc/hostname");
  expect(toolSummary("noop", {})).toBe("noop");
  expect(toolSummary("bash", { command: "x".repeat(300) }).length).toBeLessThan(140);
});

test("a settled call that waits on the owner carries its approval, and is drawn once", () => {
  const call = { id: "c1", name: "read", arguments: { path: "/etc/hostname" } };
  const reply: ChatMessage = { type: "assistant", id: "2", text: "", thinking: "", toolCalls: [call], model: null, usage: null, stopReason: "toolUse", error: null };
  const live = { ...emptyChat.live, running: true, tools: [{ callId: "c1", name: "read", status: "pending" as const, output: "", awaitingApproval: "a1" }] };
  const items = chatItems({ ...emptyChat, messages: [reply], live });
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ kind: "reply", tools: [{ status: "waiting", approvalId: "a1", summary: "read · /etc/hostname" }] });
});

test("formats countdowns, costs, and token counts", () => {
  expect(formatCountdown(47 * 60_000 + 10_000, 0)).toBe("47:10");
  expect(formatCountdown(3_725_000, 0)).toBe("1:02:05");
  expect(formatCountdown(0, 5000)).toBe("0:00");
  expect([formatCost(0), formatCost(0.0042), formatCost(1.5)]).toEqual(["$0.00", "$0.0042", "$1.50"]);
  expect([formatTokens(950), formatTokens(12_340), formatTokens(2_500_000)]).toEqual(["950", "12.3k", "2.50M"]);
});

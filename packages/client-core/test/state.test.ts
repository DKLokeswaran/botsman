import type { Approval, Bot, ChatMessage } from "@botsman/protocol";
import { expect, test } from "vitest";
import { addPending, chatItems, chatSubtitle, contextTokens, formatCost, formatCountdown, formatMessageTime, formatTokens, toolSummary, applyChatEvent, applyHistoryPage, applyServerEvent, defaultSendMode, emptyChat, emptyServerState, offeredSendModes, sortBots } from "../src/index.ts";

const user = (id: string, text: string): ChatMessage => ({ type: "user", id, at: null, text });
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
  const reply: ChatMessage = { type: "assistant", id: "2", at: null, text: "", thinking: "", toolCalls: [call], model: null, usage: null, stopReason: "toolUse", error: null };
  const result: ChatMessage = { type: "tool_result", id: "3", toolCallId: "c1", toolName: "bash", output: "hi", isError: false };
  const items = chatItems({ ...emptyChat, messages: [user("1", "run it"), reply, result] });
  expect(items.map((item) => item.kind)).toEqual(["user", "run"]);
  expect(items[1]).toMatchObject({ steps: [{ kind: "work", tools: [{ summary: "bash · echo hi", status: "done", output: "hi" }] }] });
});

test("the reply being written comes after the settled messages, with a call that waits on the owner", () => {
  const live = { ...emptyChat.live, running: true, streamingText: "Working on it", tools: [{ callId: "c9", name: "read", status: "pending" as const, output: "", awaitingApproval: "a1" }] };
  const items = chatItems({ ...emptyChat, messages: [user("1", "go")], live });
  expect(items.at(-1)).toMatchObject({ kind: "run", working: true, steps: [{ kind: "work", tools: [{ status: "waiting", approvalId: "a1" }] }, { kind: "text", text: "Working on it" }] });
});

test("queued and pending messages come last", () => {
  const live = { ...emptyChat.live, running: true, streamingText: "…", queued: [{ id: "q1", text: "later", mode: "queue" as const }] };
  const state = addPending({ ...emptyChat, live }, { requestId: "r1", text: "sending", mode: "queue", failed: undefined });
  expect(chatItems(state).map((item) => item.kind)).toEqual(["run", "queued", "pending"]);
});

const assistant = (id: string, text: string, change: Partial<Extract<ChatMessage, { type: "assistant" }>> = {}): ChatMessage => ({
  type: "assistant", id, at: null, text, thinking: "", toolCalls: [], model: null, usage: null, stopReason: "stop", error: null, ...change,
});
const usage = (cost: number) => ({ inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 15, cost });

test("one run per owner message: replies stay in view, thinking and tool calls fold between them, and the cost is the run's total", () => {
  const call = { id: "c1", name: "bash", arguments: { command: "ls" } };
  const messages: ChatMessage[] = [
    user("1", "look around"),
    assistant("2", "Let me check.", { thinking: "plan", toolCalls: [call], stopReason: "toolUse", usage: usage(0.1) }),
    { type: "tool_result", id: "3", toolCallId: "c1", toolName: "bash", output: "a b", isError: false },
    assistant("4", "Found two files.", { thinking: "done", usage: usage(0.2) }),
  ];
  const items = chatItems({ ...emptyChat, messages });
  expect(items.map((item) => item.kind)).toEqual(["user", "run"]);
  const run = items[1] as Extract<typeof items[number], { kind: "run" }>;
  expect(run.steps.map((step) => step.kind)).toEqual(["work", "text", "work", "text"]);
  expect(run.usage?.cost).toBeCloseTo(0.3);
  expect(run.usage?.totalTokens).toBe(30);
});

test("an attempt cut off and retried is left out, and a run that ends in an error keeps it", () => {
  const retried = chatItems({ ...emptyChat, messages: [user("1", "hi"), assistant("2", "half an ans", { stopReason: "error", error: "terminated" }), assistant("3", "The full answer.")] });
  expect(retried[1]).toMatchObject({ kind: "run", steps: [{ kind: "text", text: "The full answer." }], error: null });
  const failed = chatItems({ ...emptyChat, messages: [user("1", "hi"), assistant("2", "", { stopReason: "error", error: "rate limited" })] });
  expect(failed[1]).toMatchObject({ kind: "run", error: "rate limited" });
});

test("the bot shows as working from the moment it starts, before anything streams", () => {
  const items = chatItems({ ...emptyChat, messages: [user("1", "hi")], live: { ...emptyChat.live, running: true } });
  expect(items.at(-1)).toMatchObject({ kind: "run", working: true, steps: [] });
});

test("the context in use is the newest reply's total, until a clear or compaction", () => {
  const replied = [user("1", "hi"), assistant("2", "a", { usage: usage(0) }), assistant("3", "b", { usage: { ...usage(0), totalTokens: 900 } })];
  expect(contextTokens(replied)).toBe(900);
  expect(contextTokens([...replied, { type: "notice", id: "4", kind: "reset", text: "cleared" }])).toBe(0);
  expect(chatSubtitle({ model: { provider: "a", modelId: "m" }, thinkingLevel: "off" }, 0, [{ provider: "a", id: "m", name: "M", contextWindow: 1000, reasoning: false }], 250)).toBe("m · Off · 25% context · $0.00 this chat");
});

test("a tool summary is one short line", () => {
  expect(toolSummary("read", { path: "/etc/hostname" })).toBe("read · /etc/hostname");
  expect(toolSummary("noop", {})).toBe("noop");
  expect(toolSummary("bash", { command: "x".repeat(300) }).length).toBeLessThan(140);
});

test("a settled call that waits on the owner carries its approval, and is drawn once", () => {
  const call = { id: "c1", name: "read", arguments: { path: "/etc/hostname" } };
  const reply: ChatMessage = { type: "assistant", id: "2", at: null, text: "", thinking: "", toolCalls: [call], model: null, usage: null, stopReason: "toolUse", error: null };
  const live = { ...emptyChat.live, running: true, tools: [{ callId: "c1", name: "read", status: "pending" as const, output: "", awaitingApproval: "a1" }] };
  const items = chatItems({ ...emptyChat, messages: [reply], live });
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ kind: "run", steps: [{ kind: "work", tools: [{ status: "waiting", approvalId: "a1", summary: "read · /etc/hostname" }] }] });
});

test("formats countdowns, costs, and token counts", () => {
  expect(formatCountdown(47 * 60_000 + 10_000, 0)).toBe("47:10");
  expect(formatCountdown(3_725_000, 0)).toBe("1:02:05");
  expect(formatCountdown(0, 5000)).toBe("0:00");
  expect([formatCost(0), formatCost(0.0042), formatCost(1.5)]).toEqual(["$0.00", "$0.0042", "$1.50"]);
  expect([formatTokens(950), formatTokens(12_340), formatTokens(2_500_000)]).toEqual(["950", "12.3k", "2.50M"]);
});

test("shows a message's time today, Yesterday for the day before, and the date before that", () => {
  const now = new Date(2026, 10, 16, 15, 0).getTime();
  expect(formatMessageTime(new Date(2026, 10, 16, 7, 4).getTime(), now)).toMatch(/7:04/);
  expect(formatMessageTime(new Date(2026, 10, 15, 23, 59).getTime(), now)).toBe("Yesterday");
  expect(formatMessageTime(new Date(2026, 9, 12, 9, 0).getTime(), now)).toMatch(/12/);
});

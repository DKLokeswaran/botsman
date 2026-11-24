import type { ChatMessage, LiveState, LiveTool, ModelRef, ToolCall, Usage } from "@botsman/protocol";
import type { ChatState, PendingSend } from "./chat-state.ts";
import { formatMessageTime, formatUsage } from "./format.ts";

// One tool call as a chat shows it: what ran, how far it got, and its result once there is one.
export type ToolLine = {
  callId: string;
  name: string;
  summary: string;
  status: "waiting" | "running" | "done" | "failed";
  output: string;
  // The approval this call is waiting on, when it needs the owner.
  approvalId: string | undefined;
};

// One step of a run: something the bot said, which stays in view, or the thinking and tool calls between two things
// it said, which fold away.
export type RunStep = { kind: "text"; id: string; text: string } | { kind: "work"; id: string; thinking: string; tools: ToolLine[] };

// Everything the bot did for one message from the owner, drawn as one reply. `usage` is the whole run's total, and
// `working` holds while the bot is still at it, including before anything has streamed.
export type RunItem = { kind: "run"; id: string; at: number | null; steps: RunStep[]; model: ModelRef | null; usage: Usage | null; error: string | null; working: boolean };

// A chat as a list of things to draw, in order. Both apps draw from this, so they group and label alike.
export type ChatItem =
  | { kind: "user"; id: string; at: number | null; text: string }
  | RunItem
  | { kind: "notice"; id: string; text: string }
  | { kind: "queued"; id: string; text: string; mode: "steer" | "queue" }
  | { kind: "pending"; id: string; text: string; failed: string | undefined }
  | { kind: "failure"; id: string; text: string };

type Assistant = Extract<ChatMessage, { type: "assistant" }>;
type ToolResult = Extract<ChatMessage, { type: "tool_result" }>;
type Context = { results: Map<string, ToolResult>; waiting: Map<string, string> };

const LIVE_ID = "live";
// Past this length a streaming reply no longer fades in, since each fade redraws the whole reply every frame.
const FADE_LIMIT = 4_000;
const SUMMARY_LENGTH = 120;

export function chatItems(state: ChatState): ChatItem[] {
  const context: Context = { results: toolResults(state.messages), waiting: waitingApprovals(state.live) };
  const items = groupRuns(state.messages, context);
  const withLive = addLive(items, state.live);
  return [...withLive, ...failureItems(state.live), ...state.live.queued.map(queuedItem), ...state.pending.map(pendingItem)];
}

// A reply that failed shows why, with Retry. One the owner stopped shows a plain note instead.
function failureItems(live: LiveState): ChatItem[] {
  if (live.failure === null) return [];
  if (live.failure.reason === "aborted") return [{ kind: "notice", id: "stopped", text: "Stopped" }];
  return [{ kind: "failure", id: "failure", text: live.failure.detail ?? live.failure.reason }];
}

// A short line saying what a tool call does: the command, the path, or the first argument.
export function toolSummary(name: string, args: Record<string, unknown>): string {
  const oneLine = mainArgument(args).replace(/\s+/g, " ").trim();
  const cut = oneLine.length > SUMMARY_LENGTH ? `${oneLine.slice(0, SUMMARY_LENGTH)}…` : oneLine;
  return cut === "" ? name : `${name} · ${cut}`;
}

const SUMMARY_KEYS = ["command", "path", "file", "query", "url", "action"];

// The argument that best says what a call does, as text: the first of SUMMARY_KEYS that is set, or else the first one.
function mainArgument(args: Record<string, unknown>): string {
  const key = SUMMARY_KEYS.find((name) => args[name] !== undefined && args[name] !== null);
  const main = key === undefined ? Object.values(args)[0] : args[key];
  if (main === undefined) return "";
  return typeof main === "string" ? main : JSON.stringify(main);
}

// The bot's messages between two owner messages or notices form one run. Tool results are drawn inside their call.
function groupRuns(messages: ChatMessage[], context: Context): ChatItem[] {
  const items: ChatItem[] = [];
  let run: Assistant[] = [];
  const closeRun = () => {
    if (run.length > 0) items.push(runItem(run, context));
    run = [];
  };
  for (const message of messages) {
    if (message.type === "assistant") run.push(message);
    else if (message.type === "user" || message.type === "notice") {
      closeRun();
      items.push(message.type === "user" ? { kind: "user", id: message.id, at: message.at, text: message.text } : { kind: "notice", id: message.id, text: message.text });
    }
  }
  closeRun();
  return items;
}

function runItem(messages: Assistant[], context: Context): RunItem {
  const kept = withoutRetriedAttempts(messages);
  const last = kept.at(-1)!;
  return { kind: "run", id: kept[0]!.id, at: kept[0]!.at, steps: runSteps(kept, context), model: last.model, usage: totalUsage(kept), error: last.error, working: false };
}

// An attempt that failed and was followed by another one, such as a reply cut off and retried, is left out.
function withoutRetriedAttempts(messages: Assistant[]): Assistant[] {
  const kept = messages.filter((message, index) => message.stopReason !== "error" || index === messages.length - 1);
  return kept.length > 0 ? kept : messages.slice(-1);
}

// Each message's thinking and tool calls join the fold before or after its text; text closes a fold.
function runSteps(messages: Assistant[], context: Context): RunStep[] {
  const steps: RunStep[] = [];
  for (const message of messages) {
    addWork(steps, message.id, message.thinking, []);
    if (message.text.trim() !== "") steps.push({ kind: "text", id: `${message.id}-text`, text: message.text });
    addWork(steps, `${message.id}-tools`, "", message.toolCalls.map((call) => settledTool(call, context)));
  }
  return steps;
}

// Adds thinking and tools to the open fold at the end, or starts one.
function addWork(steps: RunStep[], id: string, thinking: string, tools: ToolLine[]): void {
  if (thinking.trim() === "" && tools.length === 0) return;
  const open = steps.at(-1);
  if (open?.kind === "work") {
    open.thinking = [open.thinking, thinking].filter((part) => part.trim() !== "").join("\n\n");
    open.tools.push(...tools);
    return;
  }
  steps.push({ kind: "work", id, thinking: thinking.trim(), tools });
}

function totalUsage(messages: Assistant[]): Usage | null {
  const usages = messages.flatMap((message) => (message.usage === null ? [] : [message.usage]));
  if (usages.length === 0) return null;
  return usages.reduce((sum, usage) => ({
    inputTokens: sum.inputTokens + usage.inputTokens,
    outputTokens: sum.outputTokens + usage.outputTokens,
    cacheReadTokens: sum.cacheReadTokens + usage.cacheReadTokens,
    cacheWriteTokens: sum.cacheWriteTokens + usage.cacheWriteTokens,
    totalTokens: sum.totalTokens + usage.totalTokens,
    cost: sum.cost + usage.cost,
  }));
}

// What is happening right now joins the run it belongs to: the run after the owner's latest message, or a new one
// when nothing has arrived yet, so the chat shows the bot working from the moment it starts.
function addLive(items: ChatItem[], live: LiveState): ChatItem[] {
  if (isIdle(live)) return items;
  const last = items.at(-1);
  const current: RunItem = last?.kind === "run" ? last : { kind: "run", id: LIVE_ID, at: null, steps: [], model: null, usage: null, error: null, working: false };
  const updated = withLive(current, live);
  return last?.kind === "run" ? [...items.slice(0, -1), updated] : [...items, updated];
}

function isIdle(live: LiveState): boolean {
  return !live.running && live.streamingText === "" && live.streamingThinking === "" && live.tools.length === 0;
}

// The run with the live thinking, tools not yet in its steps, and streaming text added at the end.
function withLive(current: RunItem, live: LiveState): RunItem {
  const settledCalls = new Set(current.steps.flatMap((step) => (step.kind === "work" ? step.tools.map((tool) => tool.callId) : [])));
  const steps = current.steps.map((step) => (step.kind === "work" ? { ...step, tools: [...step.tools] } : step));
  addWork(steps, `${LIVE_ID}-work`, live.streamingThinking, live.tools.filter((tool) => !settledCalls.has(tool.callId)).map(liveTool));
  if (live.streamingText !== "") steps.push({ kind: "text", id: `${LIVE_ID}-text`, text: live.streamingText });
  return { ...current, steps, error: live.running ? null : current.error, working: live.running };
}

function toolResults(messages: ChatMessage[]): Map<string, ToolResult> {
  const results = new Map<string, ToolResult>();
  for (const message of messages) if (message.type === "tool_result") results.set(message.toolCallId, message);
  return results;
}

function waitingApprovals(live: LiveState): Map<string, string> {
  return new Map(live.tools.flatMap((tool) => (tool.awaitingApproval === null ? [] : [[tool.callId, tool.awaitingApproval] as const])));
}

// A call with no result yet is running, or waiting when it needs the owner's answer first.
function settledTool(call: ToolCall, context: Context): ToolLine {
  const result = context.results.get(call.id);
  const approvalId = context.waiting.get(call.id);
  const unfinished = approvalId === undefined ? "running" : "waiting";
  const status = result === undefined ? unfinished : result.isError ? "failed" : "done";
  return { callId: call.id, name: call.name, summary: toolSummary(call.name, call.arguments), status, output: result?.output ?? "", approvalId: result === undefined ? approvalId : undefined };
}

function liveTool(tool: LiveTool): ToolLine {
  const status = tool.awaitingApproval !== null ? "waiting" : tool.status === "done" ? "done" : "running";
  return { callId: tool.callId, name: tool.name, summary: tool.name, status, output: tool.output, approvalId: tool.awaitingApproval ?? undefined };
}

function queuedItem(queued: { id: string; text: string; mode: "steer" | "queue" }): ChatItem {
  return { kind: "queued", id: `queued-${queued.id}`, text: queued.text, mode: queued.mode };
}

function pendingItem(send: PendingSend): ChatItem {
  return { kind: "pending", id: send.requestId, text: send.text, failed: send.failed };
}

// The line a folded step shows: what it is doing while it is the run's live edge, and a summary once done.
export function workLabel(step: Extract<RunStep, { kind: "work" }>, live: boolean): string {
  const running = step.tools.find((tool) => tool.status === "running" || tool.status === "waiting");
  if (live && running !== undefined) return running.status === "waiting" ? `Waiting for you: ${running.summary}` : `Running ${running.summary}`;
  if (live && step.tools.length === 0) return "Thinking…";
  const parts = step.thinking === "" ? [] : ["Thought"];
  if (step.tools.length > 0) parts.push(`ran ${step.tools.length} ${step.tools.length === 1 ? "tool" : "tools"}`);
  const failed = step.tools.filter((tool) => tool.status === "failed").length;
  if (failed > 0) parts.push(`${failed} failed`);
  const label = parts.join(" · ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Whether a working run still needs a "Working…" line: nothing has arrived yet, or its last step is finished text
// waiting for what comes next.
export function showsWorking(run: RunItem): boolean {
  return run.working && (run.steps.length === 0 || run.steps.at(-1)!.kind === "text") && !run.steps.some((step) => step.id === `${LIVE_ID}-text`);
}

// The line under a finished run: its tokens and cost, and what Copy puts on the clipboard. Either is undefined when the
// run has none, and a run with neither, or one still working, has no line.
export function runFooter(run: RunItem): { usage: string | undefined; copyText: string | undefined } | undefined {
  const usage = run.usage === null ? undefined : formatUsage(run.usage);
  const copyText = runText(run) || undefined;
  return run.working || (usage === undefined && copyText === undefined) ? undefined : { usage, copyText };
}

// Everything the bot said in a run, without its thinking or tool calls.
function runText(run: RunItem): string {
  return run.steps.flatMap((step) => (step.kind === "text" ? [step.text.trim()] : [])).join("\n\n");
}

// Whether newly streamed text fades in: only on the run's streaming edge, and only while the reply is short.
export function fadesIn(text: string, streaming: boolean): boolean {
  return streaming && text.length <= FADE_LIMIT;
}

const TOOL_VERBS: Record<ToolLine["status"], string> = { waiting: "Waiting", running: "Running", done: "Ran", failed: "Failed" };

// The word a tool line starts with, for how far its call got.
export function toolVerb(status: ToolLine["status"]): string {
  return TOOL_VERBS[status];
}

// The small line under a message the bot hasn't taken yet.
export function queuedNote(mode: "steer" | "queue"): string {
  return mode === "steer" ? "Steering the reply" : "Queued";
}

// A message's time, for the small line beside it. Entries without a time show none.
export function messageTime(at: number | null, now = Date.now()): string | undefined {
  return at === null ? undefined : formatMessageTime(at, now);
}

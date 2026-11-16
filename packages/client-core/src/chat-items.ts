import type { ChatMessage, LiveState, LiveTool, ModelRef, ToolCall, Usage } from "@botsman/protocol";
import type { ChatState, PendingSend } from "./chat-state.ts";

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
  const main = args.command ?? args.path ?? args.file ?? args.query ?? args.url ?? args.action ?? Object.values(args)[0];
  const detail = typeof main === "string" ? main : main === undefined ? "" : JSON.stringify(main);
  const oneLine = detail.replace(/\s+/g, " ").trim();
  const cut = oneLine.length > SUMMARY_LENGTH ? `${oneLine.slice(0, SUMMARY_LENGTH)}…` : oneLine;
  return cut === "" ? name : `${name} · ${cut}`;
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
  if (!live.running && live.streamingText === "" && live.streamingThinking === "" && live.tools.length === 0) return items;
  const last = items.at(-1);
  const current: RunItem = last?.kind === "run" ? last : { kind: "run", id: LIVE_ID, at: null, steps: [], model: null, usage: null, error: null, working: false };
  const settledCalls = new Set(current.steps.flatMap((step) => (step.kind === "work" ? step.tools.map((tool) => tool.callId) : [])));
  const steps = current.steps.map((step) => (step.kind === "work" ? { ...step, tools: [...step.tools] } : step));
  addWork(steps, `${LIVE_ID}-work`, live.streamingThinking, live.tools.filter((tool) => !settledCalls.has(tool.callId)).map(liveTool));
  if (live.streamingText !== "") steps.push({ kind: "text", id: `${LIVE_ID}-text`, text: live.streamingText });
  const updated: RunItem = { ...current, steps, error: live.running ? null : current.error, working: live.running };
  return last?.kind === "run" ? [...items.slice(0, -1), updated] : [...items, updated];
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

// What Copy puts on the clipboard for a run: everything the bot said, without its thinking or tool calls.
export function runText(run: RunItem): string {
  return run.steps.flatMap((step) => (step.kind === "text" ? [step.text.trim()] : [])).join("\n\n");
}

// Whether newly streamed text fades in: only on the run's streaming edge, and only while the reply is short.
export function fadesIn(text: string, streaming: boolean): boolean {
  return streaming && text.length <= FADE_LIMIT;
}

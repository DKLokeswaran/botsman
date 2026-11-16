import type { ChatMessage, LiveTool, ModelRef, ToolCall, Usage } from "@botsman/protocol";
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

// A chat as a list of things to draw, in order. Both apps draw from this, so they group and label alike.
export type ChatItem =
  | { kind: "user"; id: string; text: string }
  | { kind: "reply"; id: string; text: string; thinking: string; tools: ToolLine[]; model: ModelRef | null; usage: Usage | null; error: string | null; streaming: boolean }
  | { kind: "notice"; id: string; text: string }
  | { kind: "queued"; id: string; text: string; mode: "steer" | "queue" }
  | { kind: "pending"; id: string; text: string; failed: string | undefined }
  | { kind: "failure"; id: string; text: string };

const LIVE_ID = "live";
const SUMMARY_LENGTH = 120;

export function chatItems(state: ChatState): ChatItem[] {
  const results = toolResults(state.messages);
  const waiting = new Map(state.live.tools.flatMap((tool) => (tool.awaitingApproval === null ? [] : [[tool.callId, tool.awaitingApproval] as const])));
  const settled = state.messages.flatMap((message) => settledItem(message, results, waiting));
  return [...settled, ...liveItems(state), ...state.live.queued.map(queuedItem), ...state.pending.map(pendingItem)];
}

// A short line saying what a tool call does: the command, the path, or the first argument.
export function toolSummary(name: string, args: Record<string, unknown>): string {
  const main = args.command ?? args.path ?? args.file ?? args.query ?? args.url ?? args.action ?? Object.values(args)[0];
  const detail = typeof main === "string" ? main : main === undefined ? "" : JSON.stringify(main);
  const oneLine = detail.replace(/\s+/g, " ").trim();
  const cut = oneLine.length > SUMMARY_LENGTH ? `${oneLine.slice(0, SUMMARY_LENGTH)}…` : oneLine;
  return cut === "" ? name : `${name} · ${cut}`;
}

type ToolResult = Extract<ChatMessage, { type: "tool_result" }>;

function toolResults(messages: ChatMessage[]): Map<string, ToolResult> {
  const results = new Map<string, ToolResult>();
  for (const message of messages) if (message.type === "tool_result") results.set(message.toolCallId, message);
  return results;
}

// Tool results are drawn inside the reply that made the call, so they have no item of their own.
function settledItem(message: ChatMessage, results: Map<string, ToolResult>, waiting: Map<string, string>): ChatItem[] {
  if (message.type === "tool_result") return [];
  if (message.type === "user") return [{ kind: "user", id: message.id, text: message.text }];
  if (message.type === "notice") return [{ kind: "notice", id: message.id, text: message.text }];
  const tools = message.toolCalls.map((call) => settledTool(call, results.get(call.id), waiting.get(call.id)));
  return [{ kind: "reply", id: message.id, text: message.text, thinking: message.thinking, tools, model: message.model, usage: message.usage, error: message.error, streaming: false }];
}

// A call with no result yet is running, or waiting when it needs the owner's answer first.
function settledTool(call: ToolCall, result: ToolResult | undefined, approvalId: string | undefined): ToolLine {
  const unfinished = approvalId === undefined ? "running" : "waiting";
  const status = result === undefined ? unfinished : result.isError ? "failed" : "done";
  return { callId: call.id, name: call.name, summary: toolSummary(call.name, call.arguments), status, output: result?.output ?? "", approvalId: result === undefined ? approvalId : undefined };
}

// What is happening right now: the reply being written and the tools it is running, then a failure if it ended in one.
function liveItems(state: ChatState): ChatItem[] {
  const { live } = state;
  const settledCalls = new Set(state.messages.flatMap((message) => (message.type === "assistant" ? message.toolCalls.map((call) => call.id) : [])));
  const tools = live.tools.filter((tool) => !settledCalls.has(tool.callId)).map(liveTool);
  const writing = live.streamingText !== "" || live.streamingThinking !== "" || tools.length > 0;
  const reply: ChatItem[] = writing
    ? [{ kind: "reply", id: LIVE_ID, text: live.streamingText, thinking: live.streamingThinking, tools, model: null, usage: null, error: null, streaming: live.running }]
    : [];
  const failure: ChatItem[] = live.failure === null ? [] : [{ kind: "failure", id: "failure", text: live.failure.detail ?? live.failure.reason }];
  return [...reply, ...failure];
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

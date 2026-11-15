import type { ChatMessage, ChatTotals, LiveState, LiveTool, QueuedMessage, Usage } from "@botsman/protocol";
import type { AssistantMessage, Message, ToolResultMessage, Usage as PiUsage } from "@earendil-works/pi-ai";

// The parts of a Pi conversation view the apps need, as plain data. The engine hands these over; this module
// never imports Pi Durable, so a Pi upgrade only touches the engine and this converter.
export type ViewEntry = {
  // Pi numbers entries; the protocol sends ids as strings.
  readonly id: number;
  readonly kind: string;
  readonly model?: readonly Message[];
  readonly data?: unknown;
};

export type ViewDocs = Readonly<Record<string, unknown>>;

// Entry kinds Botsman writes: an owner message shown without the memory text sent with it, and the save turn.
export const OWNER_MESSAGE_KIND = "botsman.owner-message";
export const PRE_COMPACTION_KIND = "botsman.pre-compaction";

// Turns one transcript entry into a chat message, or nothing for entries the apps don't show.
export function toChatMessage(entry: ViewEntry): ChatMessage | undefined {
  const message = entry.model?.[0];
  const id = String(entry.id);
  switch (entry.kind) {
    case OWNER_MESSAGE_KIND:
      return { type: "user", id: id, text: String((entry.data as { text?: string } | undefined)?.text ?? "") };
    case "pi.user":
      return { type: "user", id: id, text: textOf(message) };
    case "pi.assistant":
      return message?.role === "assistant" ? assistantMessage(id, message) : undefined;
    case "pi.tool-result":
      return message?.role === "toolResult" ? toolResultMessage(id, message) : undefined;
    case PRE_COMPACTION_KIND:
      return { type: "notice", id: id, kind: "pre_compaction_save", text: "Saving notes and memory before compacting the chat" };
    case "pi.compaction":
      return { type: "notice", id: id, kind: "compaction", text: "The chat was compacted" };
    case "pi.reset":
      return { type: "notice", id: id, kind: "reset", text: "The chat context was cleared" };
    default:
      return undefined;
  }
}

function assistantMessage(id: string, message: AssistantMessage): ChatMessage {
  return {
    type: "assistant",
    id,
    text: message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join(""),
    thinking: message.content.flatMap((part) => (part.type === "thinking" ? [part.thinking] : [])).join(""),
    toolCalls: message.content.flatMap((part) => (part.type === "toolCall" ? [{ id: part.id, name: part.name, arguments: part.arguments }] : [])),
    model: { provider: message.provider, modelId: message.model },
    usage: toUsage(message.usage),
    stopReason: message.stopReason,
    error: message.errorMessage ?? null,
  };
}

function toolResultMessage(id: string, message: ToolResultMessage): ChatMessage {
  return { type: "tool_result", id, toolCallId: message.toolCallId, toolName: message.toolName, output: textOf(message), isError: message.isError };
}

function textOf(message: Message | undefined): string {
  if (message === undefined || !("content" in message)) return "";
  if (typeof message.content === "string") return message.content;
  return message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("");
}

export function toUsage(usage: PiUsage | undefined): Usage | null {
  if (usage === undefined) return null;
  return {
    inputTokens: usage.input,
    outputTokens: usage.output,
    cacheReadTokens: usage.cacheRead,
    cacheWriteTokens: usage.cacheWrite,
    totalTokens: usage.totalTokens,
    cost: usage.cost.total,
  };
}

type LiveDoc = {
  run?: unknown;
  generation?: { message?: { content?: readonly { type: string; text?: string; thinking?: string }[] } };
  tools?: readonly { callId: string; name: string; status: LiveTool["status"]; output?: string }[];
  compactions?: readonly unknown[];
  runFailure?: { reason: string; detail?: string };
};

type InboxDoc = { items?: readonly { id: number; mode: string; content?: unknown; entry?: { kind?: string; data?: unknown } }[] };

// The live state of a chat, from Pi's live and inbox documents. `approvals` maps tool call ids to waiting approvals.
export function toLiveState(docs: ViewDocs, approvals: ReadonlyMap<string, string>): LiveState {
  const live = (docs["pi.live"] ?? {}) as LiveDoc;
  const streaming = live.generation?.message?.content ?? [];
  return {
    running: live.run !== undefined,
    streamingText: streaming.flatMap((part) => (part.type === "text" ? [part.text ?? ""] : [])).join(""),
    streamingThinking: streaming.flatMap((part) => (part.type === "thinking" ? [part.thinking ?? ""] : [])).join(""),
    tools: (live.tools ?? []).map((tool) => ({
      callId: tool.callId,
      name: tool.name,
      status: tool.status,
      output: tool.output ?? "",
      awaitingApproval: approvals.get(tool.callId) ?? null,
    })),
    queued: queuedMessages(docs["pi.inbox"] as InboxDoc | undefined),
    compacting: (live.compactions?.length ?? 0) > 0,
    failure: live.runFailure === undefined ? null : { reason: live.runFailure.reason, detail: live.runFailure.detail ?? null },
  };
}

function queuedMessages(inbox: InboxDoc | undefined): QueuedMessage[] {
  return (inbox?.items ?? []).flatMap((item) => {
    if (item.mode !== "steer" && item.mode !== "followUp") return [];
    const shown = item.entry?.kind === OWNER_MESSAGE_KIND ? (item.entry.data as { text?: string }).text : undefined;
    const text = shown ?? (typeof item.content === "string" ? item.content : "");
    return [{ id: String(item.id), text, mode: item.mode === "steer" ? ("steer" as const) : ("queue" as const) }];
  });
}

// The chat's spend so far, summed over every model it used.
export function toTotals(docs: ViewDocs): ChatTotals {
  const models = ((docs["pi.usage"] ?? {}) as { models?: Record<string, PiUsage> }).models ?? {};
  const usage: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0, cost: 0 };
  for (const model of Object.values(models)) {
    usage.inputTokens += model.input;
    usage.outputTokens += model.output;
    usage.cacheReadTokens += model.cacheRead;
    usage.cacheWriteTokens += model.cacheWrite;
    usage.totalTokens += model.totalTokens;
    usage.cost += model.cost.total;
  }
  return { usage };
}

import { arr, bool, int, lit, nullable, num, obj, oneOf, opt, type Static, str, union } from "@earendil-works/pi-schema";
import { ModelRef, ThinkingLevel } from "./bots.ts";

export const Usage = obj({
  inputTokens: int(),
  outputTokens: int(),
  cacheReadTokens: int(),
  cacheWriteTokens: int(),
  totalTokens: int(),
  cost: num(),
});
export type Usage = Static<typeof Usage>;

export const ToolCall = obj({
  id: str(),
  name: str(),
  arguments: obj({}, { open: true }),
});
export type ToolCall = { id: string; name: string; arguments: Record<string, unknown> };

// One item in a bot's chat, as the apps show it.
// `at` is when the message was written, in milliseconds, or null for entries that record no time.
export const ChatMessage = union([
  obj({ type: lit("user"), id: str(), at: nullable(int()), text: str() }),
  obj({
    type: lit("assistant"),
    id: str(),
    at: nullable(int()),
    text: str(),
    thinking: str(),
    toolCalls: arr(ToolCall),
    model: nullable(ModelRef),
    usage: nullable(Usage),
    stopReason: str(),
    error: nullable(str()),
  }),
  obj({ type: lit("tool_result"), id: str(), toolCallId: str(), toolName: str(), output: str(), isError: bool() }),
  obj({ type: lit("notice"), id: str(), kind: oneOf(["compaction", "pre_compaction_save", "reset"]), text: str() }),
]);
export type ChatMessage =
  | { type: "user"; id: string; at: number | null; text: string }
  | {
      type: "assistant";
      id: string;
      at: number | null;
      text: string;
      thinking: string;
      toolCalls: ToolCall[];
      model: ModelRef | null;
      usage: Usage | null;
      stopReason: string;
      error: string | null;
    }
  | { type: "tool_result"; id: string; toolCallId: string; toolName: string; output: string; isError: boolean }
  | { type: "notice"; id: string; kind: "compaction" | "pre_compaction_save" | "reset"; text: string };

export const LiveTool = obj({
  callId: str(),
  name: str(),
  status: oneOf(["pending", "running", "done"]),
  output: str(),
  awaitingApproval: nullable(str()),
});
export type LiveTool = Static<typeof LiveTool>;

export const QueuedMessage = obj({ id: str(), text: str(), mode: oneOf(["steer", "queue"]) });
export type QueuedMessage = Static<typeof QueuedMessage>;

// What is happening in a chat right now: a reply being written, tools running, messages waiting.
export const LiveState = obj({
  running: bool(),
  streamingText: str(),
  streamingThinking: str(),
  tools: arr(LiveTool),
  queued: arr(QueuedMessage),
  compacting: bool(),
  failure: nullable(obj({ reason: str(), detail: nullable(str()) })),
});
export type LiveState = Static<typeof LiveState>;

export const ChatTotals = obj({ usage: Usage });
export type ChatTotals = Static<typeof ChatTotals>;

export const ChatSettings = obj({
  model: nullable(ModelRef),
  thinkingLevel: ThinkingLevel,
});
export type ChatSettings = Static<typeof ChatSettings>;

export const ChatSnapshot = obj({
  botId: str(),
  messages: arr(ChatMessage),
  hasEarlier: bool(),
  live: LiveState,
  totals: ChatTotals,
  settings: ChatSettings,
});
export type ChatSnapshot = Omit<Static<typeof ChatSnapshot>, "messages"> & { messages: ChatMessage[] };

export const ChatHistoryPage = obj({ messages: arr(ChatMessage), hasEarlier: bool() });
export type ChatHistoryPage = { messages: ChatMessage[]; hasEarlier: boolean };

// `send` starts a reply, or queues when one is running; `steer` joins the running reply; `queue` waits for it.
export const SendModes = ["send", "steer", "queue"] as const;
export const SendMessageRequest = obj({
  text: str({ minLength: 1, maxLength: 100_000 }),
  mode: opt(oneOf(SendModes)),
  requestId: opt(str({ minLength: 1, maxLength: 200 })),
});
export type SendMessageRequest = Static<typeof SendMessageRequest>;

export const SendMessageResponse = obj({ submissionId: str(), placed: oneOf(["started", "steered", "queued"]) });
export type SendMessageResponse = Static<typeof SendMessageResponse>;

export const ChatSettingsUpdate = obj({
  model: opt(nullable(ModelRef)),
  thinkingLevel: opt(ThinkingLevel),
});
export type ChatSettingsUpdate = Static<typeof ChatSettingsUpdate>;

// Events on one chat's stream, each with the chat's sequence number.
export type ChatEvent =
  | { type: "message"; message: ChatMessage }
  | { type: "live"; live: LiveState }
  | { type: "totals"; totals: ChatTotals }
  | { type: "settings"; settings: ChatSettings };

import type { ChatEvent, ChatHistoryPage, ChatMessage, ChatSettings, ChatSnapshot, ChatTotals, LiveState, SendMessageRequest } from "@botsman/protocol";

type SendMode = NonNullable<SendMessageRequest["mode"]>;

// A message the owner sent that the chat has not shown yet, or that failed to send.
export type PendingSend = { requestId: string; text: string; mode: SendMode; failed: string | undefined };

export type ChatState = {
  status: "loading" | "ready";
  messages: ChatMessage[];
  hasEarlier: boolean;
  live: LiveState;
  totals: ChatTotals;
  settings: ChatSettings;
  pending: PendingSend[];
};

const IDLE: LiveState = { running: false, streamingText: "", streamingThinking: "", tools: [], queued: [], compacting: false, failure: null };
const NO_USAGE = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0, cost: 0 };

export const emptyChat: ChatState = {
  status: "loading",
  messages: [],
  hasEarlier: false,
  live: IDLE,
  totals: { usage: NO_USAGE },
  settings: { model: null, thinkingLevel: "medium" },
  pending: [],
};

// A fresh snapshot replaces what the server sent before. Sends still on their way stay.
export function applyChatSnapshot(state: ChatState, snapshot: ChatSnapshot): ChatState {
  return settlePending({
    status: "ready",
    messages: snapshot.messages,
    hasEarlier: snapshot.hasEarlier,
    live: snapshot.live,
    totals: snapshot.totals,
    settings: snapshot.settings,
    pending: state.pending,
  });
}

export function applyChatEvent(state: ChatState, event: ChatEvent): ChatState {
  if (event.type === "message") return settlePending({ ...state, messages: withMessage(state.messages, event.message) });
  if (event.type === "live") return settlePending({ ...state, live: event.live });
  if (event.type === "totals") return { ...state, totals: event.totals };
  return { ...state, settings: event.settings };
}

// Puts an older page of history in front of what is shown.
export function applyHistoryPage(state: ChatState, page: ChatHistoryPage): ChatState {
  const known = new Set(state.messages.map((message) => message.id));
  const older = page.messages.filter((message) => !known.has(message.id));
  return { ...state, messages: [...older, ...state.messages], hasEarlier: page.hasEarlier };
}

export function addPending(state: ChatState, send: PendingSend): ChatState {
  return { ...state, pending: [...state.pending.filter((other) => other.requestId !== send.requestId), send] };
}

export function failPending(state: ChatState, requestId: string, reason: string): ChatState {
  return { ...state, pending: state.pending.map((send) => (send.requestId === requestId ? { ...send, failed: reason } : send)) };
}

export function dropPending(state: ChatState, requestId: string): ChatState {
  return { ...state, pending: state.pending.filter((send) => send.requestId !== requestId) };
}

// A message that arrives twice, as can happen around a reconnect, replaces its earlier copy.
function withMessage(messages: ChatMessage[], message: ChatMessage): ChatMessage[] {
  const at = messages.findIndex((other) => other.id === message.id);
  if (at === -1) return [...messages, message];
  return messages.map((other, index) => (index === at ? message : other));
}

// A pending send is done once the server shows it, as a message in the chat or as one waiting in the queue.
function settlePending(state: ChatState): ChatState {
  if (state.pending.length === 0) return state;
  const shown = shownTexts(state);
  const pending = state.pending.filter((send) => send.failed !== undefined || !takeOne(shown, send.text));
  return pending.length === state.pending.length ? state : { ...state, pending };
}

// How many times each text the owner sent shows in the newest part of the chat or in the queue.
function shownTexts(state: ChatState): Map<string, number> {
  const recent = state.messages.slice(-(state.pending.length + 20)).flatMap((message) => (message.type === "user" ? [message.text] : []));
  const counts = new Map<string, number>();
  for (const text of [...recent, ...state.live.queued.map((queued) => queued.text)]) counts.set(text, (counts.get(text) ?? 0) + 1);
  return counts;
}

function takeOne(counts: Map<string, number>, text: string): boolean {
  const left = counts.get(text) ?? 0;
  if (left === 0) return false;
  counts.set(text, left - 1);
  return true;
}

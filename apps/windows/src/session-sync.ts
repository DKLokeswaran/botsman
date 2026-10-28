/** Per-session approval cards and transcript merge. Both clients share this behaviour. */

export const RESOLVED_CARD_MS = 5000;

export const LABEL_ALLOWED_ONCE = "Allowed once";
export const LABEL_ALLOWED_SESSION = "Allowed for session";
export const LABEL_ALLOWED_ALWAYS = "Always allowed";
export const LABEL_DENIED = "Denied";
export const LABEL_ANSWERED_ELSEWHERE = "Answered on another device";
export const LABEL_DENIED_ELSEWHERE = "Denied on another device";
export const LABEL_APPROVED_ELSEWHERE = "Approved on another device";
export const LABEL_TIMED_OUT = "Timed out";

export type TranscriptLine = {
  role: string;
  text: string;
  messageId: string;
  seq: number | null;
};

export type HistoryEntry = {
  role: string;
  text: string;
  rowId: string;
};

export type ApprovalCard = {
  id: string;
  sessionId: string;
  requestId: string;
  description: string;
  command: string;
  resolvedLabel: string | null;
  awaitingTool: boolean;
};

export type ApprovalBook = Record<string, ApprovalCard>;

export type ApprovalEffect = { type: "arm" | "disarm"; sessionId: string };

export type ApprovalResult = { book: ApprovalBook; effects: ApprovalEffect[] };

const SILENT_REASONS = new Set(["interrupted", "shutdown", "session_closed"]);

export function choiceLabel(choice: string): string {
  if (choice === "once") return LABEL_ALLOWED_ONCE;
  if (choice === "session") return LABEL_ALLOWED_SESSION;
  if (choice === "always") return LABEL_ALLOWED_ALWAYS;
  if (choice === "deny") return LABEL_DENIED;
  return "Resolved";
}

export function visibleApproval(book: ApprovalBook, sessionId: string | null): ApprovalCard | null {
  if (!sessionId) return null;
  return book[sessionId] ?? null;
}

export function sameTranscript(left: TranscriptLine[], right: TranscriptLine[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((line, index) => {
    const other = right[index];
    return (
      line.role === other.role &&
      line.text === other.text &&
      line.messageId === other.messageId &&
      line.seq === other.seq
    );
  });
}

/** A line was added or its text changed. Learning a row id for the same text does not count. */
export function transcriptGrew(prev: TranscriptLine[], next: TranscriptLine[]): boolean {
  if (next.length > prev.length) return true;
  if (next.length !== prev.length) return false;
  return next.some((line, index) => line.role !== prev[index].role || line.text !== prev[index].text);
}

export function toolResultText(payload: Record<string, unknown>): string {
  return [payload.result, payload.result_text, payload.summary]
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object") return JSON.stringify(part);
      return "";
    })
    .join("\n");
}

export const SESSION_UNAVAILABLE_NOTICE = "That chat is no longer available";

/** Clear the open chat after session.resume / session.activate returns session not found. */
export function afterStaleSessionDropped<T extends { liveId: string | null; lines: TranscriptLine[]; status: string }>(
  view: T,
  notice: string = SESSION_UNAVAILABLE_NOTICE,
): T & { approval: null; question: null; focus: null; showCommand: false } {
  return {
    ...view,
    liveId: null,
    lines: [],
    approval: null,
    question: null,
    focus: null,
    showCommand: false,
    status: notice,
  };
}

export function mergeHistory(local: TranscriptLine[], history: HistoryEntry[]): TranscriptLine[] {
  const used = new Set<number>();
  const merged: TranscriptLine[] = [];

  const take = (predicate: (line: TranscriptLine) => boolean): number => {
    for (let index = 0; index < local.length; index += 1) {
      if (used.has(index)) continue;
      if (predicate(local[index])) return index;
    }
    return -1;
  };

  for (const row of history) {
    const role = row.role || "assistant";
    const text = row.text;
    const rowId = row.rowId;
    let index = rowId ? take((line) => line.messageId === rowId) : -1;
    if (index < 0) {
      index = take((line) => !line.messageId && line.role === role && line.text === text);
    }
    if (index < 0 && role === "assistant") {
      index = take((line) => {
        if (line.messageId || line.role !== "assistant") return false;
        return text.startsWith(line.text) || line.text.startsWith(text);
      });
    }
    if (index >= 0) {
      const line = local[index];
      used.add(index);
      const keepStream =
        !line.messageId && line.role === "assistant" && line.text.startsWith(text) && line.text.length > text.length;
      merged.push({
        role,
        text: keepStream ? line.text : text,
        messageId: rowId || line.messageId,
        seq: line.seq,
      });
    } else {
      merged.push({ role, text, messageId: rowId, seq: null });
    }
  }

  let lastUsed = -1;
  for (const index of used) lastUsed = Math.max(lastUsed, index);
  for (let index = lastUsed + 1; index < local.length; index += 1) {
    if (!used.has(index)) merged.push(local[index]);
  }
  return merged;
}

function unchanged(book: ApprovalBook): ApprovalResult {
  return { book, effects: [] };
}

function located(book: ApprovalBook, id: string): { sessionId: string; card: ApprovalCard } | null {
  for (const [sessionId, card] of Object.entries(book)) {
    if (card.id === id || card.requestId === id) return { sessionId, card };
  }
  return null;
}

function without(book: ApprovalBook, sessionId: string): ApprovalBook {
  if (!(sessionId in book)) return book;
  const next = { ...book };
  delete next[sessionId];
  return next;
}

export function noteLocalChoice(book: ApprovalBook, card: ApprovalCard, choice: string): ApprovalResult {
  const sessionId = card.sessionId;
  if (!sessionId) return unchanged(book);
  return {
    book: {
      ...book,
      [sessionId]: { ...card, resolvedLabel: choiceLabel(choice), awaitingTool: false },
    },
    effects: [{ type: "arm", sessionId }],
  };
}

export function restoreOpen(book: ApprovalBook, card: ApprovalCard): ApprovalResult {
  const sessionId = card.sessionId;
  if (!sessionId) return unchanged(book);
  return {
    book: {
      ...book,
      [sessionId]: { ...card, resolvedLabel: null, awaitingTool: false },
    },
    effects: [{ type: "disarm", sessionId }],
  };
}

export function rememberOpen(book: ApprovalBook, card: ApprovalCard, resolvedIds: ReadonlySet<string>): ApprovalResult {
  if (!card.sessionId) return unchanged(book);
  if (resolvedIds.has(card.id) || (card.requestId && resolvedIds.has(card.requestId))) return unchanged(book);
  const existing = book[card.sessionId];
  if (existing && existing.id === card.id && !existing.resolvedLabel) return unchanged(book);
  const effects: ApprovalEffect[] = existing?.resolvedLabel ? [{ type: "disarm", sessionId: card.sessionId }] : [];
  return {
    book: {
      ...book,
      [card.sessionId]: { ...card, resolvedLabel: null, awaitingTool: false },
    },
    effects,
  };
}

export function onRequestCancel(
  book: ApprovalBook,
  id: string,
  reason: string,
  answeredIds: ReadonlySet<string>,
): ApprovalResult {
  const found = located(book, id);
  if (!found) return unchanged(book);
  const { sessionId, card } = found;
  if (answeredIds.has(card.id) || (card.requestId && answeredIds.has(card.requestId))) {
    return unchanged(book);
  }
  if (reason === "resolved") {
    return {
      book: {
        ...book,
        [sessionId]: { ...card, resolvedLabel: LABEL_ANSWERED_ELSEWHERE, awaitingTool: true },
      },
      effects: [{ type: "arm", sessionId }],
    };
  }
  if (reason === "timeout") {
    return {
      book: {
        ...book,
        [sessionId]: { ...card, resolvedLabel: LABEL_TIMED_OUT, awaitingTool: false },
      },
      effects: [{ type: "arm", sessionId }],
    };
  }
  if (SILENT_REASONS.has(reason) || reason !== "resolved") {
    return { book: without(book, sessionId), effects: [{ type: "disarm", sessionId }] };
  }
  return unchanged(book);
}

export function onApprovalCancelled(book: ApprovalBook, requestIds: readonly string[]): ApprovalResult {
  let next = book;
  const effects: ApprovalEffect[] = [];
  for (const id of requestIds) {
    const found = located(next, id);
    if (!found) continue;
    next = without(next, found.sessionId);
    effects.push({ type: "disarm", sessionId: found.sessionId });
  }
  return { book: next, effects };
}

export function onToolComplete(book: ApprovalBook, sessionId: string, resultText: string): ApprovalResult {
  const card = book[sessionId];
  if (!card?.awaitingTool) return unchanged(book);
  const blocked = /BLOCKED:/i.test(resultText);
  const denied = blocked && /denied by user/i.test(resultText);
  if (denied) {
    return {
      book: {
        ...book,
        [sessionId]: { ...card, resolvedLabel: LABEL_DENIED_ELSEWHERE, awaitingTool: false },
      },
      effects: [{ type: "arm", sessionId }],
    };
  }
  if (blocked) return unchanged(book);
  return {
    book: {
      ...book,
      [sessionId]: { ...card, resolvedLabel: LABEL_APPROVED_ELSEWHERE, awaitingTool: false },
    },
    effects: [{ type: "arm", sessionId }],
  };
}

export function onNewerMessage(book: ApprovalBook, sessionId: string): ApprovalResult {
  const card = book[sessionId];
  if (!card?.resolvedLabel) return unchanged(book);
  return { book: without(book, sessionId), effects: [{ type: "disarm", sessionId }] };
}

export function expireResolved(book: ApprovalBook, sessionId: string): ApprovalResult {
  const card = book[sessionId];
  if (!card?.resolvedLabel) return unchanged(book);
  return { book: without(book, sessionId), effects: [{ type: "disarm", sessionId }] };
}

export type OpenChat = { runtimeId: string; resumeId: string };

export type AttachCall = { method: "resume" | "activate"; sessionId: string };

export type RouteCall = { method: "focus" } | AttachCall;

/** Runtime id for events, plus the stored id that session.resume accepts. */
export function chatAfterAttach(
  requestedId: string,
  result: { sessionId: string; storedSessionId?: string; sessionKey?: string },
): OpenChat {
  const runtimeId = result.sessionId || requestedId;
  const stored = (result.storedSessionId || result.sessionKey || "").trim();
  let resumeId = stored;
  if (!resumeId && requestedId && requestedId !== runtimeId) resumeId = requestedId;
  if (!resumeId) resumeId = requestedId || runtimeId;
  return { runtimeId, resumeId };
}

/** Re-attach an open chat. A distinct runtime id uses session.activate, never session.resume. */
export function reattachCall(chat: OpenChat): AttachCall {
  if (chat.runtimeId && chat.resumeId && chat.runtimeId !== chat.resumeId) {
    return { method: "activate", sessionId: chat.runtimeId };
  }
  return { method: "resume", sessionId: chat.resumeId || chat.runtimeId };
}

/**
 * 4007 or 4001 for the runtime id keeps the chat while a stored resume id remains.
 * 4007 from session.resume of that stored id drops the chat.
 */
export function shouldDropOpenChat(
  chat: OpenChat | null,
  failedId: string,
  failedMethod: "resume" | "activate",
): boolean {
  if (!chat) return false;
  if (failedId === chat.runtimeId && chat.resumeId && chat.resumeId !== chat.runtimeId) return false;
  if (failedMethod === "resume" && failedId === chat.resumeId) return true;
  if (failedMethod === "activate" && failedId === chat.runtimeId && (!chat.resumeId || chat.resumeId === chat.runtimeId)) {
    return true;
  }
  return failedId === chat.resumeId;
}

/** Notification and push ids are often runtime ids. Those attach with session.activate. */
export function openCallForRoute(
  routeSessionId: string,
  knownStoredIds: readonly string[],
  current: OpenChat | null,
): RouteCall {
  if (!routeSessionId) return { method: "focus" };
  if (current && (routeSessionId === current.runtimeId || routeSessionId === current.resumeId)) {
    return { method: "focus" };
  }
  if (knownStoredIds.includes(routeSessionId)) return { method: "resume", sessionId: routeSessionId };
  return { method: "activate", sessionId: routeSessionId };
}

/** A sessions list refresh does not retarget or clear the open chat. */
export function openChatAfterListUpdate(chat: OpenChat, sessionIds: readonly string[]): OpenChat {
  void sessionIds;
  return chat;
}

/** The session list and transcript stay mounted while the socket is down for reconnect. */
export function showOpenChat(connected: boolean, reconnecting: boolean): boolean {
  return connected || reconnecting;
}

/**
 * Generation for the open chat. A refresh captures current at start and aborts
 * when it no longer matches. begin() runs before a user-driven attach.
 * commit() runs when that attach wins, so a refresh that sampled begin()'s
 * value still aborts.
 */
export class OpenEpoch {
  current = 0;

  begin(): number {
    this.current += 1;
    return this.current;
  }

  commit(expected: number): boolean {
    if (this.current !== expected) return false;
    this.current = expected + 1;
    return true;
  }

  same(expected: number): boolean {
    return this.current === expected;
  }

  invalidate(): void {
    this.current += 1;
  }
}

export type AttachedIds = {
  sessionId: string;
  storedSessionId?: string;
  sessionKey?: string;
};

export type ReattachOutcome =
  | { status: "aborted" }
  | { status: "attached"; requestedId: string; opened: AttachedIds }
  | { status: "dropped"; failedId: string; method: "resume" | "activate" }
  | { status: "kept" };

/**
 * Re-attach the chat a refresh started with. After every await, abort when
 * stillOpen is false so a newer chat is not replaced. Activate 4001 and 4007
 * both fall back to session.resume of a distinct stored id.
 */
export async function reattachOpenChat(input: {
  chat: OpenChat;
  stillOpen: () => boolean;
  activate: (sessionId: string) => Promise<AttachedIds>;
  resume: (sessionId: string) => Promise<AttachedIds>;
  isAttachFailure: (error: unknown) => boolean;
}): Promise<ReattachOutcome> {
  if (!input.stillOpen()) return { status: "aborted" };
  const call = reattachCall(input.chat);
  try {
    const opened =
      call.method === "activate"
        ? await input.activate(call.sessionId)
        : await input.resume(call.sessionId);
    if (!input.stillOpen()) return { status: "aborted" };
    return { status: "attached", requestedId: call.sessionId, opened };
  } catch (error) {
    if (!input.isAttachFailure(error)) {
      if (!input.stillOpen()) return { status: "aborted" };
      return { status: "kept" };
    }
    const stored = input.chat.resumeId;
    if (call.method === "activate" && stored && stored !== input.chat.runtimeId) {
      try {
        const opened = await input.resume(stored);
        if (!input.stillOpen()) return { status: "aborted" };
        return { status: "attached", requestedId: stored, opened };
      } catch (fallback) {
        if (!input.stillOpen()) return { status: "aborted" };
        if (input.isAttachFailure(fallback)) {
          return { status: "dropped", failedId: stored, method: "resume" };
        }
        return { status: "kept" };
      }
    }
    if (!input.stillOpen()) return { status: "aborted" };
    return { status: "dropped", failedId: call.sessionId, method: call.method };
  }
}

export function syncOpen(book: ApprovalBook, sessionId: string, openIds: ReadonlySet<string>): ApprovalResult {
  const card = book[sessionId];
  if (!card || card.resolvedLabel) return unchanged(book);
  if (openIds.has(card.id) || (card.requestId && openIds.has(card.requestId))) return unchanged(book);
  return { book: without(book, sessionId), effects: [{ type: "disarm", sessionId }] };
}

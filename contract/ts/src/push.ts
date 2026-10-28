/**
 * Structured UnifiedPush / toast payload shared by the Windows app and tests.
 * The notifier writes the same fields. Keep the encoded object under 4 KB.
 */

export type PushKind = "approval" | "clarify" | "reply" | "error";

export interface PushRoute {
  kind: PushKind;
  title: string;
  body: string;
  sessionId: string;
  profile: string;
  requestId: string;
  messageId: string;
  seq: number | null;
  action: "once" | "deny" | null;
}

export interface TrackedMessage {
  messageId: string;
  seq: number | null;
}

export interface PushRequest {
  id: string;
  params: Record<string, unknown>;
}

export interface RouteFocus {
  sessionId: string;
  target: "approval" | "question" | "message" | "none";
  requestId: string;
  messageId: string;
  seq: number | null;
  resolved: boolean;
  messageIndex: number;
}

const KINDS = new Set<PushKind>(["approval", "clarify", "reply", "error"]);

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function parsePush(raw: string): PushRoute | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  const record = asRecord(parsed);
  const kind = text(record.kind);
  if (!KINDS.has(kind as PushKind)) {
    return null;
  }
  const seq = record.seq;
  return {
    kind: kind as PushKind,
    title: text(record.title),
    body: text(record.body),
    sessionId: text(record.session_id),
    profile: text(record.profile),
    requestId: text(record.request_id),
    messageId: text(record.message_id),
    seq: typeof seq === "number" && Number.isFinite(seq) ? seq : null,
    action: null,
  };
}

export function formatPush(route: PushRoute): string {
  return JSON.stringify({
    kind: route.kind,
    title: route.title,
    body: route.body,
    session_id: route.sessionId,
    profile: route.profile,
    request_id: route.requestId,
    message_id: route.messageId,
    seq: route.seq,
  });
}

export function openRequestIds(requests: PushRequest[]): Set<string> {
  const ids = new Set<string>();
  for (const request of requests) {
    if (request.id) {
      ids.add(request.id);
    }
    const requestId = request.params.request_id;
    if (typeof requestId === "string" && requestId) {
      ids.add(requestId);
    }
    const questions = request.params.questions;
    if (!Array.isArray(questions)) {
      continue;
    }
    for (const question of questions) {
      const qid = asRecord(question).qid;
      if (typeof qid === "string" && qid) {
        ids.add(qid);
      }
    }
  }
  return ids;
}

export function routeFocus(route: PushRoute, openIds: Set<string>, messages: TrackedMessage[]): RouteFocus {
  if (route.kind === "approval" || route.kind === "clarify") {
    const resolved = route.requestId.length > 0 && !openIds.has(route.requestId);
    return {
      sessionId: route.sessionId,
      target: route.kind === "clarify" ? "question" : "approval",
      requestId: route.requestId,
      messageId: "",
      seq: null,
      resolved,
      messageIndex: -1,
    };
  }
  let messageIndex = -1;
  if (route.messageId) {
    messageIndex = messages.findIndex((line) => line.messageId === route.messageId);
  }
  if (messageIndex < 0 && route.seq !== null) {
    messageIndex = messages.findIndex((line) => line.seq === route.seq);
  }
  if (messageIndex < 0 && messages.length > 0) {
    messageIndex = messages.length - 1;
  }
  return {
    sessionId: route.sessionId,
    target: route.sessionId || messageIndex >= 0 ? "message" : "none",
    requestId: "",
    messageId: route.messageId,
    seq: route.seq,
    resolved: false,
    messageIndex,
  };
}

import { HermesError } from "./index.ts";

export const SESSION_UNAVAILABLE_NOTICE = "That chat is no longer available";
/** session.resume of an unknown id, or of a runtime id. */
export const SESSION_UNAVAILABLE_CODE = 4007;
/** session.activate of an unknown id, a dead runtime id, or a stored id. */
export const SESSION_ACTIVATE_REJECTED_CODE = 4001;
export const RESUME_RETRY_MS = 30_000;
export const RECONNECT_BACKOFF_CAP_MS = 15_000;

/**
 * JSON-RPC failure on session.resume / session.activate that means this id
 * cannot be attached. Resume uses 4007. Activate of an unknown or dead
 * runtime id uses 4001. Both leave the socket up.
 */
export function isSessionAttachFailure(error: unknown): boolean {
  if (!(error instanceof HermesError)) {
    return false;
  }
  if (error.code === SESSION_UNAVAILABLE_CODE || error.code === SESSION_ACTIVATE_REJECTED_CODE) {
    return true;
  }
  return error.message.toLowerCase().includes("session not found");
}

export function parseRetryAfterSeconds(headers: { name: string; value: string }[]): number | null {
  for (const header of headers) {
    if (header.name.toLowerCase() !== "retry-after") {
      continue;
    }
    const parsed = Number.parseInt(header.value.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

/** Exponential reconnect wait with up to 25% jitter; honour HTTP Retry-After when present. */
export function reconnectDelayMs(backoffMs: number, retryAfterSeconds: number | null = null): number {
  const base = retryAfterSeconds != null && retryAfterSeconds > 0
    ? Math.max(backoffMs, retryAfterSeconds * 1000)
    : backoffMs;
  return base + Math.random() * base * 0.25;
}

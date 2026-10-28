export const SESSION_UNAVAILABLE_NOTICE = "That chat is no longer available";
export const SESSION_UNAVAILABLE_CODE = 4007;
export const RESUME_RETRY_MS = 30_000;
export const RECONNECT_BACKOFF_CAP_MS = 15_000;

/** JSON-RPC failure on session.resume / session.activate that means the id is gone server-side. */
export function isSessionAttachFailure(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const candidate = error as { code?: number | null; message?: string };
  if (candidate.code === SESSION_UNAVAILABLE_CODE) {
    return true;
  }
  return String(candidate.message ?? "").toLowerCase().includes("session not found");
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

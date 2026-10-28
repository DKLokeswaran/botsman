export const NEAR_BOTTOM_PX = 80;

export type ChatScrollEvent = "user_send" | "reply_stream" | "session_open";

export function shouldFollow(distanceFromBottom: number, event: ChatScrollEvent): boolean {
  switch (event) {
    case "user_send":
    case "session_open":
      return true;
    case "reply_stream":
      return distanceFromBottom <= NEAR_BOTTOM_PX;
  }
}

export function shouldShowJumpToLatest(distanceFromBottom: number): boolean {
  return distanceFromBottom > NEAR_BOTTOM_PX;
}

export function distanceFromBottom(scrollTop: number, scrollHeight: number, clientHeight: number): number {
  return Math.max(0, scrollHeight - scrollTop - clientHeight);
}

/** Classify a transcript change. Bulk loads use the near-bottom rule, not forced send-follow. */
export function classifyScrollEvent(
  previousCount: number,
  previousLastText: string,
  count: number,
  lastRole: string,
  lastText: string,
): ChatScrollEvent | null {
  if (count === previousCount + 1 && lastRole === "user") {
    return "user_send";
  }
  if (lastRole === "assistant" && (count > previousCount || lastText !== previousLastText)) {
    return "reply_stream";
  }
  if (count > previousCount + 1) {
    return "reply_stream";
  }
  return null;
}

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

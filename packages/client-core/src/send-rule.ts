import type { LiveState, SendMessageRequest } from "@botsman/protocol";

export type SendMode = NonNullable<SendMessageRequest["mode"]>;

// Whether a bot is at work on its chat: replying, using tools, or compacting.
export function isBusy(live: Pick<LiveState, "running" | "compacting">): boolean {
  return live.running || live.compacting;
}

// The ways of sending an app offers for a bot's state: Send while idle, Queue or Steer while busy.
// Both apps ask this, so they always show the same choices.
export function offeredSendModes(live: Pick<LiveState, "running" | "compacting">): SendMode[] {
  return isBusy(live) ? ["queue", "steer"] : ["send"];
}

// The mode a plain press of Enter uses.
export function defaultSendMode(live: Pick<LiveState, "running" | "compacting">): SendMode {
  return offeredSendModes(live)[0]!;
}

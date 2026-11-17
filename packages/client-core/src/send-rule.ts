import type { LiveState, SendMessageRequest } from "@botsman/protocol";

export type SendMode = NonNullable<SendMessageRequest["mode"]>;

// The ways of sending an app offers for a bot's state: Send while idle, Queue or Steer while busy.
// Both apps ask this, so they always show the same choices.
export function offeredSendModes(live: Pick<LiveState, "running" | "compacting">): SendMode[] {
  return live.running || live.compacting ? ["queue", "steer"] : ["send"];
}

// The mode a plain press of Enter uses.
export function defaultSendMode(live: Pick<LiveState, "running" | "compacting">): SendMode {
  return offeredSendModes(live)[0]!;
}

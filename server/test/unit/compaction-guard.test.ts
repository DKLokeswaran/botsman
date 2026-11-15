import type { Bot } from "@botsman/protocol";
import type { Conversation, Harness } from "@earendil-works/pi-durable";
import { describe, expect, it } from "vitest";
import { CompactionGuard } from "../../src/engine/compaction-guard.ts";
import type { ChatView, EngineServices } from "../../src/engine/types.ts";
import { OWNER_MESSAGE_KIND, PRE_COMPACTION_KIND } from "../../src/events/chat-view.ts";

const WINDOW = 200_000;

// A guard over a fake conversation that records what it is asked to do.
function guard() {
  const calls: string[] = [];
  const root = {
    submit: async () => {
      calls.push("save");
      return { wait: async () => undefined };
    },
    compact: async () => {
      calls.push("compact");
      return "task";
    },
  } as unknown as Conversation;
  const harness = { waitForTask: async () => undefined } as unknown as Harness;
  const services = {
    chatSettings: () => ({ model: { provider: "p", modelId: "m" }, thinkingLevel: "off" }),
    models: { getModel: () => ({ contextWindow: WINDOW }) },
    log: () => {},
  } as unknown as EngineServices;
  return { calls, guard: new CompactionGuard(root, harness, services, "b1") };
}

const bot = { id: "b1", isMain: false } as Bot;
const answer = (id: number, tokens: number, stopReason = "stop") => ({ id, kind: "pi.assistant", model: [{ role: "assistant", stopReason, usage: { totalTokens: tokens } }] });
const entry = (id: number, kind: string) => ({ id, kind });
const view = (entries: object[]): ChatView => ({ entries, docs: {} }) as unknown as ChatView;
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

describe("saving before compaction", () => {
  it("asks for a save turn, then compacts, when a reply nears the limit", async () => {
    const { calls, guard: subject } = guard();
    subject.afterRun(bot, view([entry(1, OWNER_MESSAGE_KIND), answer(2, WINDOW - 20_000)]));
    await settle();
    expect(calls).toEqual(["save", "compact"]);
  });

  it("only compacts when a restart left a save turn without its compaction", async () => {
    const { calls, guard: subject } = guard();
    subject.afterRun(bot, view([entry(1, OWNER_MESSAGE_KIND), answer(2, WINDOW - 20_000), entry(3, PRE_COMPACTION_KIND), answer(4, WINDOW - 19_000)]));
    await settle();
    expect(calls).toEqual(["compact"]);
  });

  it.each(["error", "aborted"])("doesn't compact after a save turn whose reply ended with %s", async (stopReason) => {
    const { calls, guard: subject } = guard();
    subject.afterRun(bot, view([entry(1, OWNER_MESSAGE_KIND), answer(2, WINDOW - 20_000), entry(3, PRE_COMPACTION_KIND), answer(4, 0, stopReason)]));
    await settle();
    expect(calls).toEqual([]);
  });

  it("does nothing once the chat was compacted after the last reply", async () => {
    const { calls, guard: subject } = guard();
    subject.afterRun(bot, view([entry(3, PRE_COMPACTION_KIND), answer(4, WINDOW - 19_000), entry(5, "pi.compaction")]));
    await settle();
    expect(calls).toEqual([]);
  });
});

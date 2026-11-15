import type { Bot } from "@botsman/protocol";
import type { Conversation, Harness } from "@earendil-works/pi-durable";
import { describe, expect, it } from "vitest";
import { CompactionGuard } from "../../src/engine/compaction-guard.ts";
import type { ChatView, EngineServices } from "../../src/engine/types.ts";
import { OWNER_MESSAGE_KIND, PRE_COMPACTION_KIND } from "../../src/events/chat-view.ts";

const WINDOW = 200_000;
const SAVE_ANSWER = 90;

const answer = (id: number, tokens: number, stopReason = "stop") => ({ id, kind: "pi.assistant", model: [{ role: "assistant", stopReason, usage: { totalTokens: tokens } }] });
const entry = (id: number, kind: string, data?: unknown) => ({ id, kind, data });
const saveEntry = (id: number, answerId: number) => entry(id, PRE_COMPACTION_KIND, { requestId: `pre-compaction:${answerId}` });
const view = (entries: object[]): ChatView => ({ entries, docs: {} }) as unknown as ChatView;
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));
const bot = { id: "b1", isMain: false } as Bot;

type SaveOutcome = { status: "done"; stopReason: string } | { status: "unanswered" };

// A guard over a fake conversation: submissions are deduplicated by request id, as in Pi, and the save turn's
// recorded answer is entry SAVE_ANSWER.
function guard(outcome: SaveOutcome = { status: "done", stopReason: "stop" }) {
  const calls: string[] = [];
  const submissions = new Map<string, object>();
  const stored = [answer(SAVE_ANSWER, 1_000, outcome.status === "done" ? outcome.stopReason : "error")];
  const settled = outcome.status === "done" ? { status: "done", answer: SAVE_ANSWER } : { status: "unanswered", reason: "aborted" };
  const root = {
    submit: async (draft: { requestId: string }) => {
      if (!submissions.has(draft.requestId)) {
        calls.push("save");
        submissions.set(draft.requestId, settled);
      }
      return { wait: async () => submissions.get(draft.requestId) };
    },
    entries: async (query: { maxEntryId: number; order: string }) => ({
      items: stored.filter((item) => item.id <= query.maxEntryId).sort((a, b) => (query.order === "descending" ? b.id - a.id : a.id - b.id)),
    }),
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
  return { calls, submissions, settled, guard: new CompactionGuard(root, harness, services, "b1") };
}

describe("saving before compaction", () => {
  it("asks for a save turn, then compacts, when a reply nears the limit", async () => {
    const { calls, guard: subject } = guard();
    subject.afterRun(bot, view([entry(1, OWNER_MESSAGE_KIND), answer(2, WINDOW - 20_000)]));
    await settle();
    expect(calls).toEqual(["save", "compact"]);
  });

  it("doesn't compact when the save turn is stopped or fails", async () => {
    const { calls, guard: subject } = guard({ status: "unanswered" });
    subject.afterRun(bot, view([entry(1, OWNER_MESSAGE_KIND), answer(2, WINDOW - 20_000)]));
    await settle();
    expect(calls).toEqual(["save"]);
  });

  it.each(["toolUse", "length", "error", "aborted"])("doesn't compact when the save turn's recorded answer ended with %s", async (stopReason) => {
    const { calls, guard: subject } = guard({ status: "done", stopReason });
    subject.afterRun(bot, view([entry(1, OWNER_MESSAGE_KIND), answer(2, WINDOW - 20_000)]));
    await settle();
    expect(calls).toEqual(["save"]);
  });

  it("only compacts a finished save turn a restart left behind", async () => {
    const { calls, submissions, settled, guard: subject } = guard();
    submissions.set("pre-compaction:2", settled);
    subject.afterRun(bot, view([entry(1, OWNER_MESSAGE_KIND), answer(2, WINDOW - 20_000), saveEntry(3, 2), answer(SAVE_ANSWER, WINDOW - 15_000)]));
    await settle();
    expect(calls).toEqual(["compact"]);
  });

  it("does nothing for an unfinished save turn when its own reply is the newest", async () => {
    const { calls, submissions, settled, guard: subject } = guard({ status: "done", stopReason: "length" });
    submissions.set("pre-compaction:2", settled);
    subject.afterRun(bot, view([entry(1, OWNER_MESSAGE_KIND), answer(2, WINDOW - 20_000), saveEntry(3, 2), answer(SAVE_ANSWER, WINDOW - 15_000, "length")]));
    await settle();
    expect(calls).toEqual([]);
  });

  it("compacts a finished save turn a restart left behind, even when the owner wrote during it", async () => {
    const { calls, submissions, settled, guard: subject } = guard();
    submissions.set("pre-compaction:2", settled);
    subject.afterRun(bot, view([answer(2, WINDOW - 20_000), saveEntry(3, 2), answer(SAVE_ANSWER, WINDOW - 15_000), entry(95, OWNER_MESSAGE_KIND), answer(96, WINDOW - 12_000)]));
    await settle();
    expect(calls).toEqual(["compact"]);
  });

  it("treats messages steered back to back into a save turn as part of it", async () => {
    const { calls, submissions, settled, guard: subject } = guard({ status: "done", stopReason: "length" });
    submissions.set("pre-compaction:2", settled);
    subject.afterRun(bot, view([entry(1, OWNER_MESSAGE_KIND), answer(2, WINDOW - 20_000), saveEntry(3, 2), answer(4, WINDOW - 18_000, "toolUse"), entry(5, OWNER_MESSAGE_KIND), entry(6, OWNER_MESSAGE_KIND), answer(SAVE_ANSWER, WINDOW - 15_000, "length")]));
    await settle();
    expect(calls).toEqual([]);
  });

  it("starts a new turn at messages queued back to back after a finished reply", async () => {
    const { calls, guard: subject } = guard();
    subject.afterRun(bot, view([entry(1, OWNER_MESSAGE_KIND), answer(2, 1_000), entry(3, OWNER_MESSAGE_KIND), entry(4, OWNER_MESSAGE_KIND), answer(5, WINDOW - 20_000)]));
    await settle();
    expect(calls).toEqual(["save", "compact"]);
  });

  it("never starts a save from a save turn's own reply after a steered message", async () => {
    const { calls, submissions, settled, guard: subject } = guard({ status: "done", stopReason: "length" });
    submissions.set("pre-compaction:2", settled);
    subject.afterRun(bot, view([entry(1, OWNER_MESSAGE_KIND), answer(2, WINDOW - 20_000), saveEntry(3, 2), answer(4, WINDOW - 18_000, "toolUse"), entry(5, OWNER_MESSAGE_KIND), answer(SAVE_ANSWER, WINDOW - 15_000, "length")]));
    await settle();
    expect(calls).toEqual([]);
  });

  it("asks again at the next reply near the limit after a save turn that didn't finish", async () => {
    const { calls, submissions, guard: subject } = guard();
    submissions.set("pre-compaction:2", { status: "unanswered", reason: "aborted" });
    subject.afterRun(bot, view([answer(2, WINDOW - 20_000), saveEntry(3, 2), entry(95, OWNER_MESSAGE_KIND), answer(96, WINDOW - 18_000)]));
    await settle();
    expect(calls).toEqual(["save", "compact"]);
    expect([...submissions.keys()]).toEqual(["pre-compaction:2", "pre-compaction:96"]);
  });

  it("does nothing once the chat was compacted after the last reply", async () => {
    const { calls, guard: subject } = guard();
    subject.afterRun(bot, view([saveEntry(3, 2), answer(4, WINDOW - 19_000), entry(5, "pi.compaction")]));
    await settle();
    expect(calls).toEqual([]);
  });
});

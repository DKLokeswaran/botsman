import type { Bot } from "@botsman/protocol";
import type { Usage } from "@earendil-works/pi-ai";
import { BACKGROUND_CONTEXT as context } from "@earendil-works/chord/context";
import type { Conversation, Harness } from "@earendil-works/pi-durable";
import { OWNER_MESSAGE_KIND, PRE_COMPACTION_KIND } from "../events/chat-view.ts";
import type { ChatView, EngineServices } from "./types.ts";

// Pi's blocking threshold sits this far below the context window; Pi's own compaction there is the safety net.
const PI_RESERVE_TOKENS = 16_384;
// Botsman starts its save turn this far before Pi's threshold.
const SAVE_MARGIN_TOKENS = 16_384;

// When a chat nears its context limit, gives the bot one turn to save what matters, then compacts.
export class CompactionGuard {
  readonly #root: Conversation;
  readonly #harness: Harness;
  readonly #services: EngineServices;
  readonly #botId: string;
  #saving = false;

  constructor(root: Conversation, harness: Harness, services: EngineServices, botId: string) {
    this.#root = root;
    this.#harness = harness;
    this.#services = services;
    this.#botId = botId;
  }

  // Runs when a reply ends, and once when the bot opens with no reply running.
  afterRun(bot: Bot, view: ChatView): void {
    if (this.#saving || compacting(view)) return;
    const work = this.#nextStep(bot, view);
    if (work === undefined) return;
    this.#saving = true;
    work()
      .catch((error) => this.#services.log(`bot ${this.#botId}: save before compaction failed: ${String(error)}`))
      .finally(() => (this.#saving = false));
  }

  // A save turn a restart left without its compaction only needs the compaction; otherwise a reply near the limit starts the save turn.
  #nextStep(bot: Bot, view: ChatView): (() => Promise<void>) | undefined {
    if (saveAwaitingCompaction(view)) return () => this.#compact();
    const last = lastAnswer(view);
    if (last === undefined || !this.#nearLimit(bot, last.usage)) return undefined;
    return () => this.#saveThenCompact(bot, last.id);
  }

  #nearLimit(bot: Bot, usage: Usage): boolean {
    const settings = this.#services.chatSettings(bot);
    if (settings.model === null) return false;
    const model = this.#services.models.getModel(settings.model.provider, settings.model.modelId);
    if (model === undefined) return false;
    const saveAt = model.contextWindow - PI_RESERVE_TOKENS - SAVE_MARGIN_TOKENS;
    return saveAt > 0 && usage.totalTokens >= saveAt;
  }

  // The request id ties the save turn to the answer that crossed the threshold, so a restart never asks twice.
  async #saveThenCompact(bot: Bot, answerId: number): Promise<void> {
    const submission = await this.#root.submit(
      { type: "input", content: savePrompt(bot), entry: { kind: PRE_COMPACTION_KIND, data: {} }, whenBusy: "followUp", requestId: `pre-compaction:${answerId}` },
      context,
    );
    // A save turn that failed or was stopped saved nothing; the next reply near the limit asks again.
    const settled = await submission.wait(context);
    if (settled.status === "done") await this.#compact();
  }

  async #compact(): Promise<void> {
    const taskId = await this.#root.compact("Keep the owner's open requests, decisions, and anything still in progress.", context);
    await this.#harness.waitForTask(taskId, context);
  }
}

function savePrompt(bot: Bot): string {
  const userMemory = bot.isMain ? ", and USER_MEMORY.md for lasting facts about the owner" : "";
  return [
    "This chat is close to its context limit and will be compacted after this turn.",
    `Save anything worth keeping now with the memory tool: notes for longer records, BOT_MEMORY.md for facts that belong in every prompt${userMemory}. Memory file edits wait for the owner's approval.`,
    "Reply with one short line when you are done.",
  ].join(" ");
}

// True when the newest input is a save turn whose last reply finished, with no compaction or reset after it.
// A save turn that failed or was stopped saved nothing, so the next reply near the limit asks again instead.
function saveAwaitingCompaction(view: ChatView): boolean {
  let lastReplyFinished: boolean | undefined;
  for (let index = view.entries.length - 1; index >= 0; index--) {
    const entry = view.entries[index]!;
    if (entry.kind === PRE_COMPACTION_KIND) return lastReplyFinished === true;
    if (entry.kind === OWNER_MESSAGE_KIND || entry.kind === "pi.compaction" || entry.kind === "pi.reset") return false;
    if (entry.kind === "pi.assistant" && lastReplyFinished === undefined) lastReplyFinished = finished(entry);
  }
  return false;
}

function finished(entry: ChatView["entries"][number]): boolean {
  const message = entry.model?.[0];
  return message?.role === "assistant" && message.stopReason !== "error" && message.stopReason !== "aborted";
}

function compacting(view: ChatView): boolean {
  const live = view.docs["pi.live"] as { compactions?: readonly unknown[] } | undefined;
  return (live?.compactions?.length ?? 0) > 0;
}

// The newest reply since the last compaction or reset; replies before one no longer reflect the context size.
function lastAnswer(view: ChatView): { id: number; usage: Usage } | undefined {
  for (let index = view.entries.length - 1; index >= 0; index--) {
    const entry = view.entries[index]!;
    if (entry.kind === "pi.compaction" || entry.kind === "pi.reset") return undefined;
    const message = entry.model?.[0];
    if (entry.kind === "pi.assistant" && message?.role === "assistant") return { id: entry.id, usage: message.usage };
  }
  return undefined;
}

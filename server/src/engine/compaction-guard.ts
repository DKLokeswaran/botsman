import type { Bot } from "@botsman/protocol";
import type { Usage } from "@earendil-works/pi-ai";
import { BACKGROUND_CONTEXT as context } from "@earendil-works/chord/context";
import type { Conversation, Harness } from "@earendil-works/pi-durable";
import { PRE_COMPACTION_KIND } from "../events/chat-view.ts";
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

  afterRun(bot: Bot, view: ChatView): void {
    if (this.#saving) return;
    const last = lastAnswer(view);
    if (last === undefined || !this.#nearLimit(bot, last.usage)) return;
    this.#saving = true;
    this.#saveThenCompact(bot, last.id)
      .catch((error) => this.#services.log(`bot ${this.#botId}: save before compaction failed: ${String(error)}`))
      .finally(() => (this.#saving = false));
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
    await submission.wait(context);
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

function lastAnswer(view: ChatView): { id: number; usage: Usage } | undefined {
  for (let index = view.entries.length - 1; index >= 0; index--) {
    const entry = view.entries[index]!;
    const message = entry.model?.[0];
    if (entry.kind === "pi.assistant" && message?.role === "assistant") return { id: entry.id, usage: message.usage };
  }
  return undefined;
}

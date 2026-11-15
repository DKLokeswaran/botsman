import type { Bot } from "@botsman/protocol";
import type { Usage } from "@earendil-works/pi-ai";
import { BACKGROUND_CONTEXT as context } from "@earendil-works/chord/context";
import type { Conversation, EntryId, Harness } from "@earendil-works/pi-durable";
import { OWNER_MESSAGE_KIND, PRE_COMPACTION_KIND, type ViewEntry } from "../events/chat-view.ts";
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

  // A save turn a restart left without its compaction is settled first; then a reply near the limit starts one.
  #nextStep(bot: Bot, view: ChatView): (() => Promise<void>) | undefined {
    const leftover = leftoverSaveRequest(view);
    const last = lastAnswer(view);
    const fresh = last !== undefined && this.#nearLimit(bot, last.usage) ? saveRequestId(last.id) : undefined;
    if (leftover === undefined && fresh === undefined) return undefined;
    return async () => {
      if (leftover !== undefined && (await this.#settleSave(bot, leftover))) return;
      if (fresh !== undefined && fresh !== leftover) await this.#settleSave(bot, fresh);
    };
  }

  #nearLimit(bot: Bot, usage: Usage): boolean {
    const settings = this.#services.chatSettings(bot);
    if (settings.model === null) return false;
    const model = this.#services.models.getModel(settings.model.provider, settings.model.modelId);
    if (model === undefined) return false;
    const saveAt = model.contextWindow - PI_RESERVE_TOKENS - SAVE_MARGIN_TOKENS;
    return saveAt > 0 && usage.totalTokens >= saveAt;
  }

  // Submits the save turn, or finds the one already submitted under this request id, waits for it, and compacts
  // when it finished. Returns whether it compacted.
  async #settleSave(bot: Bot, requestId: string): Promise<boolean> {
    const submission = await this.#root.submit(
      { type: "input", content: savePrompt(bot), entry: { kind: PRE_COMPACTION_KIND, data: { requestId } }, whenBusy: "followUp", requestId },
      context,
    );
    const settled = await submission.wait(context);
    if (settled.status !== "done" || settled.answer === undefined || !(await this.#answerFinished(settled.answer))) return false;
    await this.#compact();
    return true;
  }

  // Whether the answer Pi recorded for the save turn ended the turn.
  async #answerFinished(answerId: number): Promise<boolean> {
    const page = await this.#root.entries({ maxEntryId: answerId as EntryId, order: "descending" }, 1, undefined, context);
    const entry = page.items[0] as unknown as ViewEntry | undefined;
    return entry?.id === answerId && finished(entry);
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

// The request id of the newest save turn with no owner message, compaction, or reset after it. Once the owner writes
// again, a save whose compaction never happened is left behind, and the next reply near the limit asks anew.
function leftoverSaveRequest(view: ChatView): string | undefined {
  for (let index = view.entries.length - 1; index >= 0; index--) {
    const entry = view.entries[index]!;
    if (entry.kind === OWNER_MESSAGE_KIND || entry.kind === "pi.compaction" || entry.kind === "pi.reset") return undefined;
    if (entry.kind === PRE_COMPACTION_KIND) return (entry.data as { requestId?: string } | undefined)?.requestId;
  }
  return undefined;
}

// Tied to the answer that crossed the threshold, so a restart or a repeated check never submits that save twice.
function saveRequestId(answerId: number): string {
  return `pre-compaction:${answerId}`;
}

// A finished reply ends the turn on its own: not stopped for tool calls, cut off at the output limit, failed, or stopped.
function finished(entry: ChatView["entries"][number]): boolean {
  const message = entry.model?.[0];
  return message?.role === "assistant" && message.stopReason === "stop";
}

function compacting(view: ChatView): boolean {
  const live = view.docs["pi.live"] as { compactions?: readonly unknown[] } | undefined;
  return (live?.compactions?.length ?? 0) > 0;
}

// The newest reply to the owner since the last compaction or reset. Replies before a compaction no longer reflect the
// context size, and a save turn's own replies never start another save.
function lastAnswer(view: ChatView): { id: number; usage: Usage } | undefined {
  let answer: { id: number; usage: Usage } | undefined;
  for (let index = view.entries.length - 1; index >= 0; index--) {
    const entry = view.entries[index]!;
    if (entry.kind === PRE_COMPACTION_KIND) return undefined;
    if (entry.kind === OWNER_MESSAGE_KIND || entry.kind === "pi.compaction" || entry.kind === "pi.reset") return answer;
    const message = entry.model?.[0];
    if (answer === undefined && entry.kind === "pi.assistant" && message?.role === "assistant") answer = { id: entry.id, usage: message.usage };
  }
  return answer;
}

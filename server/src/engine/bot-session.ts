import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Bot } from "@botsman/protocol";
import { BACKGROUND_CONTEXT as context } from "@earendil-works/chord/context";
import { type Conversation, type ConversationView, type ConversationWatch, type EntryId, Harness, LiveDoc } from "@earendil-works/pi-durable";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";
import { OWNER_MESSAGE_KIND, type ViewEntry } from "../events/chat-view.ts";
import { memoryChangeText, renderMemorySection } from "../memory/prompt.ts";
import { CompactionGuard } from "./compaction-guard.ts";
import { botRegistry } from "./extensions.ts";
import { MemoryDoc } from "./memory-doc.ts";
import type { ChatView, EngineServices, SendMode, SendResult } from "./types.ts";

// A crash during an approval wait counts toward Pi's restart limit, so the limit sits well above Pi's default of 5.
const RESTART_LIMIT = 50;
const DEFAULT_CACHE_LIFETIME_MS = 5 * 60_000;

// One bot's Pi Durable Harness on its own SQLite file, and its chat with the owner as the root conversation.
export class BotSession {
  readonly botId: string;
  readonly #services: EngineServices;
  readonly #harness: Harness;
  readonly #root: Conversation;
  readonly #guard: CompactionGuard;
  #watch: ConversationWatch | undefined;
  #lastRunEndedAt = 0;

  private constructor(botId: string, services: EngineServices, harness: Harness, root: Conversation) {
    this.botId = botId;
    this.#services = services;
    this.#harness = harness;
    this.#root = root;
    this.#guard = new CompactionGuard(root, harness, services, botId);
  }

  static async open(bot: Bot, services: EngineServices): Promise<BotSession> {
    const file = services.sessionFile(bot.id);
    mkdirSync(path.dirname(file), { recursive: true });
    const harness = await Harness.open(
      await openNodeSqliteStorage(file),
      {
        models: services.models,
        registry: botRegistry(bot.id, services),
        identity: { attribution: null },
        settings: { restartLimit: RESTART_LIMIT, compaction: { enabled: true, backgroundTokens: 0 } },
        env: () => {
          const current = services.currentBot(bot.id);
          return current === undefined ? undefined : services.envFor(current);
        },
        onReport: (report) => services.log(`bot ${bot.id}: ${report.kind}: ${String(report.error)}`),
      },
      context,
    );
    const root = await harness.root(context, { agent: { cwd: bot.folder } });
    const session = new BotSession(bot.id, services, harness, root);
    await session.configure(bot);
    await session.#startWatch();
    harness.resume();
    return session;
  }

  // Applies the chat's model and reasoning effort, and the bot's folder.
  async configure(bot: Bot): Promise<void> {
    const settings = this.#services.chatSettings(bot);
    await this.#root.configure({ model: settings.model, thinkingLevel: settings.thinkingLevel, cwd: bot.folder }, context);
  }

  // Hands the owner's message to the bot, with any memory changes it hasn't seen yet.
  async send(text: string, mode: SendMode, requestId: string | undefined): Promise<SendResult> {
    const busy = (await this.#harness.snapshot(LiveDoc, this.#root.id, context))?.run !== undefined;
    const headId = (await this.#root.context(context)).head?.id;
    const head = headId === undefined ? null : String(headId);
    const now = this.#now();
    const submissionId = await this.#harness.commit(async (tx) => {
      const memory = await tx.doc(MemoryDoc, this.#root.id);
      const current = this.#services.memorySnapshot(this.botId);
      const refresh = memory.seen === null || memory.head !== head || now - Math.max(memory.lastSentAt, this.#lastRunEndedAt) > this.#cacheLifetime();
      const change = refresh ? "" : memoryChangeText(memory.seen!, current);
      const content = [change, text].filter((part) => part !== "").join("\n\n");
      const id = await this.#root.submit(tx, {
        type: "input",
        content,
        entry: { kind: OWNER_MESSAGE_KIND, data: { text } },
        whenBusy: mode === "steer" ? "steer" : "followUp",
        requestId,
      });
      if (refresh) Object.assign(memory, { frozen: renderMemorySection(current), head });
      Object.assign(memory, { seen: current, lastSentAt: now });
      return id;
    }, context);
    return { submissionId: String(submissionId), placed: placement(busy, mode) };
  }

  // Stops the reply and every process the bot started.
  async stop(): Promise<void> {
    await this.#root.abort(context);
    this.#services.stopSandbox(this.botId);
  }

  // Entries older than `before`, newest first, for loading earlier chat history.
  async entriesBefore(before: number | undefined, limit: number): Promise<{ entries: ViewEntry[]; hasEarlier: boolean }> {
    const maxEntryId = before === undefined ? undefined : ((before - 1) as EntryId);
    const page = await this.#root.entries({ maxEntryId, order: "descending" }, limit + 1, undefined, context);
    const entries = page.items as unknown as ViewEntry[];
    return { entries: entries.slice(0, limit).reverse(), hasEarlier: entries.length > limit || page.next !== undefined };
  }

  currentView(): ChatView | undefined {
    const value = this.#watch?.value;
    return value === undefined ? undefined : toChatView(value);
  }

  async close(): Promise<void> {
    await this.#watch?.stop();
    await this.#harness.close(context);
  }

  async #startWatch(): Promise<void> {
    const watch = await this.#root.watch(context);
    this.#watch = watch;
    let wasRunning = false;
    const first = toChatView(watch.value);
    this.#services.onView(this.botId, first);
    this.#checkCompactionOnOpen(first);
    watch.start(async (call) => {
      if (call.kind !== "value") return;
      const view = toChatView(call.value);
      const running = (view.docs["pi.live"] as { run?: unknown } | undefined)?.run !== undefined;
      if (wasRunning && !running) this.#runEnded(view);
      wasRunning = running;
      this.#services.onView(this.botId, view);
    });
  }

  // A restart can land between a save turn and its compaction; with no reply running, the guard finishes that work now.
  #checkCompactionOnOpen(view: ChatView): void {
    const running = (view.docs["pi.live"] as { run?: unknown } | undefined)?.run !== undefined;
    const bot = this.#services.currentBot(this.botId);
    if (!running && bot !== undefined) this.#guard.afterRun(bot, view);
  }

  #runEnded(view: ChatView): void {
    this.#lastRunEndedAt = this.#now();
    const bot = this.#services.currentBot(this.botId);
    if (bot !== undefined) this.#guard.afterRun(bot, view);
  }

  #now(): number {
    return (this.#services.now ?? Date.now)();
  }

  #cacheLifetime(): number {
    return this.#services.cacheLifetimeMs ?? DEFAULT_CACHE_LIFETIME_MS;
  }
}

function placement(busy: boolean, mode: SendMode): SendResult["placed"] {
  if (!busy) return "started";
  return mode === "steer" ? "steered" : "queued";
}

function toChatView(value: ConversationView): ChatView {
  return { entries: value.entries as unknown as ViewEntry[], docs: value.docs };
}

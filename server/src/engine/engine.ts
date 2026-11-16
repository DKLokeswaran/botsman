import type { Bot } from "@botsman/protocol";
import { notFound } from "../errors.ts";
import type { ViewEntry } from "../events/chat-view.ts";
import { BotSession } from "./bot-session.ts";
import type { ChatView, EngineServices, SendMode, SendResult } from "./types.ts";

// The only module that imports Pi Durable. Opens one Harness per bot and runs its chat.
export class Engine {
  readonly #services: EngineServices;
  readonly #sessions = new Map<string, Promise<BotSession>>();

  constructor(services: EngineServices) {
    this.#services = services;
  }

  // Opens the bot's Harness if it isn't open yet. Opening resumes any work a crash left unfinished.
  open(bot: Bot): Promise<BotSession> {
    let session = this.#sessions.get(bot.id);
    if (session === undefined) {
      session = BotSession.open(bot, this.#services);
      this.#sessions.set(bot.id, session);
      session.catch(() => this.#sessions.delete(bot.id));
    }
    return session;
  }

  async send(bot: Bot, text: string, mode: SendMode, requestId?: string): Promise<SendResult> {
    return (await this.open(bot)).send(text, mode, requestId);
  }

  async stop(bot: Bot): Promise<void> {
    await (await this.open(bot)).stop();
  }

  async compact(bot: Bot): Promise<boolean> {
    return (await this.open(bot)).compact(bot);
  }

  async clear(bot: Bot): Promise<void> {
    await (await this.open(bot)).clear();
  }

  async retry(bot: Bot): Promise<boolean> {
    return (await this.open(bot)).retry();
  }

  async configure(bot: Bot): Promise<void> {
    await (await this.open(bot)).configure(bot);
  }

  async history(bot: Bot, before: number | undefined, limit: number): Promise<{ entries: ViewEntry[]; hasEarlier: boolean }> {
    return (await this.open(bot)).entriesBefore(before, limit);
  }

  async view(bot: Bot): Promise<ChatView> {
    const view = (await this.open(bot)).currentView();
    if (view === undefined) throw notFound("Chat");
    return view;
  }

  async close(botId: string): Promise<void> {
    const session = this.#sessions.get(botId);
    this.#sessions.delete(botId);
    this.#services.stopSandbox(botId);
    await (await session?.catch(() => undefined))?.close();
  }

  async closeAll(): Promise<void> {
    await Promise.all([...this.#sessions.keys()].map((botId) => this.close(botId)));
  }
}

import type { BotActivity, ChatMessage } from "@botsman/protocol";
import type { Database, Row } from "../store/database.ts";

const PREVIEW_LENGTH = 140;

// Keeps each bot's activity line current: last message time, a preview, and replies newer than the read marker.
export class BotActivityTracker {
  readonly #db: Database;
  readonly #messages: (botId: string) => readonly ChatMessage[];
  readonly #publish: (activity: BotActivity) => void;
  readonly #last = new Map<string, string>();

  constructor(db: Database, messages: (botId: string) => readonly ChatMessage[], publish: (activity: BotActivity) => void) {
    this.#db = db;
    this.#messages = messages;
    this.#publish = publish;
  }

  get(botId: string): BotActivity {
    return botActivity(botId, this.#messages(botId), this.#readAt(botId));
  }

  // Publishes the bot's activity when it differs from what was last sent.
  refresh(botId: string): void {
    const activity = this.get(botId);
    const json = JSON.stringify(activity);
    if (this.#last.get(botId) === json) return;
    this.#last.set(botId, json);
    this.#publish(activity);
  }

  // A marker only moves forward, so a device showing an older view can't bring back unread replies.
  markRead(botId: string, upTo: number): void {
    this.#db
      .prepare("INSERT INTO read_markers (bot_id, read_at) VALUES (?, ?) ON CONFLICT (bot_id) DO UPDATE SET read_at = max(read_at, excluded.read_at)")
      .run(botId, upTo);
    this.refresh(botId);
  }

  // A new bot starts with no marker, which counts every reply as unread.
  #readAt(botId: string): number {
    const row = this.#db.prepare("SELECT read_at FROM read_markers WHERE bot_id = ?").get(botId) as Row | undefined;
    return row === undefined ? 0 : Number(row.read_at);
  }

  forget(botId: string): void {
    this.#last.delete(botId);
  }
}

// The activity line for one chat, given its messages and the time it was last read.
export function botActivity(botId: string, messages: readonly ChatMessage[], readAt: number): BotActivity {
  const spoken = messages.filter(hasText);
  const times = messages.flatMap((message) => ("at" in message && message.at !== null ? [message.at] : []));
  const unread = spoken.filter((message) => message.type === "assistant" && message.at !== null && message.at > readAt).length;
  return { botId, lastAt: times.length === 0 ? null : Math.max(...times), preview: previewOf(spoken.at(-1)), unread };
}

function hasText(message: ChatMessage): message is Extract<ChatMessage, { type: "user" | "assistant" }> {
  return (message.type === "user" || message.type === "assistant") && message.text.trim() !== "";
}

function previewOf(message: { text: string } | undefined): string {
  const line = (message?.text ?? "").replace(/\s+/g, " ").trim();
  return line.length > PREVIEW_LENGTH ? `${line.slice(0, PREVIEW_LENGTH - 1)}…` : line;
}

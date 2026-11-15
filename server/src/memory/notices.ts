import type { Database, Row } from "../store/database.ts";

export type PendingNotices = { readonly ids: readonly number[]; readonly text: string };

// Short messages for a bot, such as the owner's answer to a memory proposal, delivered with its next incoming message.
export class Notices {
  readonly #db: Database;
  readonly #now: () => number;

  constructor(db: Database, now: () => number = Date.now) {
    this.#db = db;
    this.#now = now;
  }

  add(botId: string, text: string): void {
    this.#db.prepare("INSERT INTO notices (bot_id, text, created_at) VALUES (?, ?, ?)").run(botId, text, this.#now());
  }

  pending(botId: string): PendingNotices {
    const rows = this.#db.prepare("SELECT id, text FROM notices WHERE bot_id = ? AND delivered_at IS NULL ORDER BY id").all(botId) as Row[];
    return { ids: rows.map((row) => Number(row.id)), text: rows.map((row) => String(row.text)).join("\n") };
  }

  markDelivered(ids: readonly number[]): void {
    const statement = this.#db.prepare("UPDATE notices SET delivered_at = ? WHERE id = ?");
    for (const id of ids) statement.run(this.#now(), id);
  }
}

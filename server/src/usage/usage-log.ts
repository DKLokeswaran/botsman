import type { Usage, UsageReport } from "@botsman/protocol";
import type { Database, Row } from "../store/database.ts";

const DAY_MS = 24 * 3_600_000;
const SUMS = `sum(input_tokens) AS inputTokens, sum(output_tokens) AS outputTokens, sum(cache_read_tokens) AS cacheReadTokens,
  sum(cache_write_tokens) AS cacheWriteTokens, sum(total_tokens) AS totalTokens, sum(cost) AS cost`;

// One row per bot reply, so the apps can show spending by day and by bot.
export class UsageLog {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  record(botId: string, at: number, usage: Usage): void {
    this.#db
      .prepare(
        `INSERT INTO usage_log (bot_id, at, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, total_tokens, cost)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(botId, at, usage.inputTokens, usage.outputTokens, usage.cacheReadTokens, usage.cacheWriteTokens, usage.totalTokens, usage.cost);
  }

  // Totals from the start of the day `days - 1` days ago, in the owner's timezone, up to now.
  report(days: number, tzOffsetMinutes: number, now = Date.now()): UsageReport {
    const shift = -tzOffsetMinutes * 60_000;
    const since = Math.floor((now + shift) / DAY_MS - (days - 1)) * DAY_MS - shift;
    const day = `strftime('%Y-%m-%d', (at + ${shift}) / 1000, 'unixepoch')`;
    const total = this.#db.prepare(`SELECT ${SUMS} FROM usage_log WHERE at >= ?`).get(since) as Row;
    const byDay = this.#db.prepare(`SELECT ${day} AS day, ${SUMS} FROM usage_log WHERE at >= ? GROUP BY day ORDER BY day`).all(since) as Row[];
    const byBot = this.#db.prepare(`SELECT bot_id AS botId, ${SUMS} FROM usage_log WHERE at >= ? GROUP BY bot_id ORDER BY sum(cost) DESC`).all(since) as Row[];
    return {
      since,
      total: toUsage(total),
      days: byDay.map((row) => ({ day: String(row.day), usage: toUsage(row) })),
      bots: byBot.map((row) => ({ botId: String(row.botId), usage: toUsage(row) })),
    };
  }
}

function toUsage(row: Row): Usage {
  return {
    inputTokens: Number(row.inputTokens ?? 0),
    outputTokens: Number(row.outputTokens ?? 0),
    cacheReadTokens: Number(row.cacheReadTokens ?? 0),
    cacheWriteTokens: Number(row.cacheWriteTokens ?? 0),
    totalTokens: Number(row.totalTokens ?? 0),
    cost: Number(row.cost ?? 0),
  };
}

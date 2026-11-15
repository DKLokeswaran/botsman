import { randomBytes } from "node:crypto";
import type { Avatar, Bot, BotUpdate, ChatSettings, ModelRef, PermissionMode, ThinkingLevel } from "@botsman/protocol";
import { conflict } from "../errors.ts";
import type { Database, Row } from "../store/database.ts";

export type NewBot = {
  readonly name: string;
  readonly description: string;
  readonly defaultModel: ModelRef | null;
  readonly folder: string;
  readonly isMain: boolean;
};

const DEFAULT_THINKING: ThinkingLevel = "medium";

// The bot registry in server.db. A deleted bot keeps its row, marked with `deleted_at`.
export class BotRegistry {
  readonly #db: Database;
  readonly #now: () => number;

  constructor(db: Database, now: () => number = Date.now) {
    this.#db = db;
    this.#now = now;
  }

  static newId(): string {
    return randomBytes(6).toString("hex");
  }

  list(): Bot[] {
    const rows = this.#db.prepare("SELECT * FROM bots WHERE deleted_at IS NULL ORDER BY is_main DESC, created_at").all() as Row[];
    return rows.map(toBot);
  }

  get(id: string): Bot | undefined {
    const row = this.#db.prepare("SELECT * FROM bots WHERE id = ? AND deleted_at IS NULL").get(id) as Row | undefined;
    return row === undefined ? undefined : toBot(row);
  }

  mainBot(): Bot | undefined {
    const row = this.#db.prepare("SELECT * FROM bots WHERE is_main = 1 AND deleted_at IS NULL").get() as Row | undefined;
    return row === undefined ? undefined : toBot(row);
  }

  // Folders of every bot other than `exceptId`, deleted ones included, since their files stay on disk.
  folders(exceptId: string): string[] {
    const rows = this.#db.prepare("SELECT folder FROM bots WHERE id != ?").all(exceptId) as Row[];
    return rows.map((row) => String(row.folder));
  }

  create(id: string, bot: NewBot): Bot {
    const now = this.#now();
    this.#assertNameFree(bot.name, id);
    this.#db
      .prepare(
        `INSERT INTO bots (id, name, description, is_main, model_provider, model_id, thinking_level, folder, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, bot.name, bot.description, bot.isMain ? 1 : 0, bot.defaultModel?.provider ?? null, bot.defaultModel?.modelId ?? null, DEFAULT_THINKING, bot.folder, now, now);
    return this.get(id)!;
  }

  update(id: string, change: BotUpdate): Bot {
    if (change.name !== undefined) this.#assertNameFree(change.name, id);
    const columns = updateColumns(change);
    if (columns.length > 0) {
      const sql = `UPDATE bots SET ${columns.map(([column]) => `${column} = ?`).join(", ")}, updated_at = ? WHERE id = ?`;
      this.#db.prepare(sql).run(...columns.map(([, value]) => value), this.#now(), id);
    }
    return this.get(id)!;
  }

  markDeleted(id: string): void {
    this.#db.prepare("UPDATE bots SET deleted_at = ? WHERE id = ? AND is_main = 0").run(this.#now(), id);
  }

  chatSettings(bot: Bot): ChatSettings {
    const row = this.#db.prepare("SELECT * FROM chat_settings WHERE bot_id = ?").get(bot.id) as Row | undefined;
    const override = row?.model_provider ? { provider: String(row.model_provider), modelId: String(row.model_id) } : null;
    return {
      model: override ?? bot.defaultModel,
      thinkingLevel: (row?.thinking_level as ThinkingLevel | null | undefined) ?? bot.thinkingLevel,
    };
  }

  setChatSettings(botId: string, model: ModelRef | null | undefined, thinkingLevel: ThinkingLevel | undefined): void {
    const row = this.#db.prepare("SELECT * FROM chat_settings WHERE bot_id = ?").get(botId) as Row | undefined;
    const provider = model === undefined ? (row?.model_provider ?? null) : (model?.provider ?? null);
    const modelId = model === undefined ? (row?.model_id ?? null) : (model?.modelId ?? null);
    const thinking = thinkingLevel ?? row?.thinking_level ?? null;
    this.#db
      .prepare(
        `INSERT INTO chat_settings (bot_id, model_provider, model_id, thinking_level) VALUES (?, ?, ?, ?)
         ON CONFLICT (bot_id) DO UPDATE SET model_provider = excluded.model_provider, model_id = excluded.model_id, thinking_level = excluded.thinking_level`,
      )
      .run(botId, provider as string | null, modelId as string | null, thinking as string | null);
  }

  #assertNameFree(name: string, id: string): void {
    const row = this.#db.prepare("SELECT id FROM bots WHERE lower(name) = lower(?) AND deleted_at IS NULL AND id != ?").get(name, id);
    if (row !== undefined) throw conflict(`A bot named ${name} already exists`);
  }
}

type Column = [string, string | number | null];

function updateColumns(change: BotUpdate): Column[] {
  const model = change.defaultModel;
  const candidates: [string, string | number | null | undefined][] = [
    ["name", change.name],
    ["description", change.description],
    ["avatar", jsonOrNull(change.avatar)],
    ["model_provider", model === undefined ? undefined : (model?.provider ?? null)],
    ["model_id", model === undefined ? undefined : (model?.modelId ?? null)],
    ["thinking_level", change.thinkingLevel],
    ["permission_mode", change.permissionMode],
    ["approval_wait_ms", change.approvalWaitMs],
    ["network", change.network === undefined ? undefined : Number(change.network)],
    ["connections", jsonOrNull(change.connections)],
    ["skills", jsonOrNull(change.skills)],
  ];
  return candidates.filter((candidate): candidate is Column => candidate[1] !== undefined);
}

// Undefined stays undefined (no change), null stays null, anything else becomes JSON text.
function jsonOrNull(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value;
  return JSON.stringify(value);
}

function toBot(row: Row): Bot {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description),
    isMain: row.is_main === 1,
    avatar: row.avatar === null ? null : (JSON.parse(String(row.avatar)) as Avatar),
    defaultModel: row.model_provider === null ? null : { provider: String(row.model_provider), modelId: String(row.model_id) },
    thinkingLevel: row.thinking_level as ThinkingLevel,
    folder: String(row.folder),
    permissionMode: row.permission_mode as PermissionMode,
    approvalWaitMs: Number(row.approval_wait_ms),
    network: row.network === 1,
    connections: JSON.parse(String(row.connections)) as Record<string, boolean>,
    skills: JSON.parse(String(row.skills)) as Record<string, boolean>,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

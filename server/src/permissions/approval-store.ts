import { randomUUID } from "node:crypto";
import type { Approval, MemoryEdit } from "@botsman/protocol";
import { conflict, notFound } from "../errors.ts";
import type { Database, Row } from "../store/database.ts";

export type NewApproval = {
  readonly botId: string;
  readonly conversation: string;
  readonly callId: string;
  readonly toolName: string;
  readonly args: Record<string, unknown>;
  readonly reason: string;
  readonly description: string;
  readonly command: string;
  readonly memoryEdit: MemoryEdit | null;
  readonly waitMs: number;
};

type Answer = Pick<Approval, "status" | "decision">;

// Approval requests in server.db, so they survive a restart and every device sees the same answer.
export class ApprovalStore {
  readonly #db: Database;
  readonly #now: () => number;

  constructor(db: Database, now: () => number = Date.now) {
    this.#db = db;
    this.#now = now;
  }

  create(request: NewApproval): Approval {
    const id = randomUUID();
    const now = this.#now();
    this.#db
      .prepare(
        `INSERT INTO approvals (id, bot_id, conversation, call_id, tool_name, args, reason, description, command, memory_edit, status, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      )
      .run(
        id,
        request.botId,
        request.conversation,
        request.callId,
        request.toolName,
        JSON.stringify(request.args),
        request.reason,
        request.description,
        request.command,
        request.memoryEdit === null ? null : JSON.stringify(request.memoryEdit),
        now,
        now + request.waitMs,
      );
    return this.get(id);
  }

  get(id: string): Approval {
    const row = this.#db.prepare("SELECT * FROM approvals WHERE id = ?").get(id) as Row | undefined;
    if (row === undefined) throw notFound("Approval");
    return toApproval(row);
  }

  find(id: string): Approval | undefined {
    const row = this.#db.prepare("SELECT * FROM approvals WHERE id = ?").get(id) as Row | undefined;
    return row === undefined ? undefined : toApproval(row);
  }

  // Settles a pending approval. Answering one that is already settled is a conflict.
  settle(id: string, answer: Answer): Approval {
    const result = this.#db
      .prepare("UPDATE approvals SET status = ?, decision = ?, answered_at = ? WHERE id = ? AND status = 'pending'")
      .run(answer.status, answer.decision, this.#now(), id);
    if (result.changes === 0) throw conflict("This approval was already answered");
    return this.get(id);
  }

  pendingIds(botId?: string): string[] {
    const rows = this.#db.prepare("SELECT id, bot_id FROM approvals WHERE status = 'pending'").all() as Row[];
    return rows.filter((row) => botId === undefined || row.bot_id === botId).map((row) => String(row.id));
  }

  // Pending approvals of one bot, keyed by the tool call that asked.
  pendingByCall(botId: string): Map<string, string> {
    const rows = this.#db.prepare("SELECT id, call_id FROM approvals WHERE bot_id = ? AND status = 'pending'").all(botId) as Row[];
    return new Map(rows.map((row) => [String(row.call_id), String(row.id)]));
  }

  // The newest 500 approvals of the given bots, filtered before the limit so no pending approval is left out.
  list(filter: { status?: string; botIds: readonly string[] }): Approval[] {
    if (filter.botIds.length === 0) return [];
    const bots = filter.botIds.map(() => "?").join(", ");
    const status = filter.status === undefined ? "" : "AND status = ?";
    const parameters = filter.status === undefined ? filter.botIds : [...filter.botIds, filter.status];
    const rows = this.#db.prepare(`SELECT * FROM approvals WHERE bot_id IN (${bots}) ${status} ORDER BY created_at DESC LIMIT 500`).all(...parameters) as Row[];
    return rows.map(toApproval);
  }

  grant(botId: string, conversation: string, toolName: string): void {
    this.#db
      .prepare("INSERT OR IGNORE INTO approval_grants (bot_id, conversation, tool_name, created_at) VALUES (?, ?, ?, ?)")
      .run(botId, conversation, toolName, this.#now());
  }

  hasGrant(botId: string, conversation: string, toolName: string): boolean {
    const row = this.#db.prepare("SELECT 1 FROM approval_grants WHERE bot_id = ? AND conversation = ? AND tool_name = ?").get(botId, conversation, toolName);
    return row !== undefined;
  }
}

function toApproval(row: Row): Approval {
  return {
    id: String(row.id),
    botId: String(row.bot_id),
    conversation: String(row.conversation),
    toolName: String(row.tool_name),
    reason: String(row.reason),
    description: String(row.description),
    command: String(row.command),
    memoryEdit: row.memory_edit === null ? null : (JSON.parse(String(row.memory_edit)) as MemoryEdit),
    status: row.status as Approval["status"],
    decision: (row.decision ?? null) as Approval["decision"],
    createdAt: Number(row.created_at),
    expiresAt: Number(row.expires_at),
    answeredAt: row.answered_at === null ? null : Number(row.answered_at),
  };
}

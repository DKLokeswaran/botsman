import { randomUUID } from "node:crypto";
import type { Bot, MemoryFileName, MemoryProposal } from "@botsman/protocol";
import { ApiError, conflict, notFound } from "../errors.ts";
import type { Database, Row } from "../store/database.ts";
import { assertWithinLimit, type MemoryFiles } from "./memory-files.ts";
import type { Notices } from "./notices.ts";

export type ProposalInput = {
  readonly bot: Bot;
  readonly file: MemoryFileName;
  readonly content: string;
  readonly reason: string;
  readonly conversation: string;
};

// Bot edits to memory files. Each edit waits as a proposal until the owner accepts or rejects it.
export class Proposals {
  readonly #db: Database;
  readonly #files: MemoryFiles;
  readonly #notices: Notices;
  readonly #onChange: (proposal: MemoryProposal) => void;
  readonly #now: () => number;

  constructor(db: Database, files: MemoryFiles, notices: Notices, onChange: (proposal: MemoryProposal) => void, now: () => number = Date.now) {
    this.#db = db;
    this.#files = files;
    this.#notices = notices;
    this.#onChange = onChange;
    this.#now = now;
  }

  propose(input: ProposalInput): MemoryProposal {
    assertMayWrite(input.bot, input.file);
    assertWithinLimit(input.file, input.content);
    const proposal: MemoryProposal = {
      id: randomUUID(),
      botId: input.bot.id,
      file: input.file,
      content: input.content,
      previous: this.#files.read(input.bot.id, input.file),
      reason: input.reason,
      conversation: input.conversation,
      status: "pending",
      createdAt: this.#now(),
      answeredAt: null,
    };
    this.#db
      .prepare(
        `INSERT INTO proposals (id, bot_id, file, content, previous, reason, conversation, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      )
      .run(proposal.id, proposal.botId, proposal.file, proposal.content, proposal.previous, proposal.reason, proposal.conversation, proposal.createdAt);
    this.#onChange(proposal);
    return proposal;
  }

  // Applies or drops a proposal, and leaves the bot a notice it receives with its next message.
  answer(id: string, decision: "accept" | "reject"): MemoryProposal {
    const proposal = this.get(id);
    if (proposal.status !== "pending") throw conflict("This proposal was already answered");
    if (decision === "accept") this.#files.write(proposal.botId, proposal.file, proposal.content);
    const status = decision === "accept" ? "accepted" : "rejected";
    this.#setStatus(id, status);
    this.#notices.add(proposal.botId, `The owner ${status} your proposed edit to ${proposal.file} (proposal ${id}).`);
    const answered = this.get(id);
    this.#onChange(answered);
    return answered;
  }

  // Refuses every pending proposal of a bot, for example when it is deleted.
  refuseAll(botId: string): void {
    const rows = this.#db.prepare("SELECT id FROM proposals WHERE bot_id = ? AND status = 'pending'").all(botId) as Row[];
    for (const row of rows) this.#setStatus(String(row.id), "refused");
  }

  get(id: string): MemoryProposal {
    const row = this.#db.prepare("SELECT * FROM proposals WHERE id = ?").get(id) as Row | undefined;
    if (row === undefined) throw notFound("Proposal");
    return toProposal(row);
  }

  list(filter: { status?: string; botIds: readonly string[] }): MemoryProposal[] {
    const rows = this.#db.prepare("SELECT * FROM proposals ORDER BY created_at DESC LIMIT 500").all() as Row[];
    return rows
      .map(toProposal)
      .filter((proposal) => filter.botIds.includes(proposal.botId))
      .filter((proposal) => filter.status === undefined || proposal.status === filter.status);
  }

  #setStatus(id: string, status: MemoryProposal["status"]): void {
    this.#db.prepare("UPDATE proposals SET status = ?, answered_at = ? WHERE id = ?").run(status, this.#now(), id);
  }
}

// No bot writes a PROFILE file, and only the main bot writes USER_MEMORY.md.
function assertMayWrite(bot: Bot, file: MemoryFileName): void {
  if (file === "BOT_MEMORY.md") return;
  if (file === "USER_MEMORY.md" && bot.isMain) return;
  const message = file === "USER_MEMORY.md" ? "Only the main bot writes USER_MEMORY.md; message the main bot instead" : `No bot can write ${file}`;
  throw new ApiError(403, "forbidden", message);
}

function toProposal(row: Row): MemoryProposal {
  return {
    id: String(row.id),
    botId: String(row.bot_id),
    file: row.file as MemoryFileName,
    content: String(row.content),
    previous: String(row.previous),
    reason: String(row.reason),
    conversation: String(row.conversation),
    status: row.status as MemoryProposal["status"],
    createdAt: Number(row.created_at),
    answeredAt: row.answered_at === null ? null : Number(row.answered_at),
  };
}

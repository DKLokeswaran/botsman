import { randomUUID } from "node:crypto";
import type { Bot, MemoryFileName, MemoryProposal } from "@botsman/protocol";
import { ApiError, conflict, notFound } from "../errors.ts";
import type { Database, Row } from "../store/database.ts";
import { assertWithinLimit, type MemoryFiles } from "./memory-files.ts";

export type ProposalInput = {
  readonly bot: Bot;
  readonly file: MemoryFileName;
  readonly content: string;
  readonly reason: string;
  readonly conversation: string;
};

// How the tool call that proposes an edit waits: its stop signal, and a durable memo so a rerun after a crash waits on the same proposal.
export type ProposalWait = {
  readonly signal: AbortSignal | undefined;
  readonly memo: { load(): Promise<string | undefined>; save(proposalId: string): Promise<string> };
};

type Ending = "expired" | "cancelled";

// Bot edits to memory files. The tool call that proposes an edit waits until the owner accepts or rejects it.
export class Proposals {
  readonly #db: Database;
  readonly #files: MemoryFiles;
  readonly #onChange: (proposal: MemoryProposal) => void;
  readonly #now: () => number;
  readonly #waiters = new Map<string, Set<(proposal: MemoryProposal) => void>>();

  constructor(db: Database, files: MemoryFiles, onChange: (proposal: MemoryProposal) => void, now: () => number = Date.now) {
    this.#db = db;
    this.#files = files;
    this.#onChange = onChange;
    this.#now = now;
  }

  // Proposes the edit, or finds the one this call already proposed, and waits for it to be settled.
  async proposeAndWait(input: ProposalInput, wait: ProposalWait): Promise<MemoryProposal> {
    const remembered = await wait.memo.load();
    const existing = remembered === undefined ? undefined : this.find(remembered);
    const proposal = existing ?? this.#propose(input);
    if (existing === undefined) await wait.memo.save(proposal.id);
    return this.#waitForAnswer(proposal, wait.signal);
  }

  // Applies or drops a proposal, and wakes the tool call waiting on it.
  answer(id: string, decision: "accept" | "reject"): MemoryProposal {
    const proposal = this.get(id);
    if (proposal.status !== "pending") throw conflict("This proposal was already answered");
    if (decision === "accept") this.#files.write(proposal.botId, proposal.file, proposal.content);
    const answered = this.#settle(id, decision === "accept" ? "accepted" : "rejected");
    if (answered === undefined) throw conflict("This proposal was already answered");
    return answered;
  }

  // Cancels every pending proposal of a bot, for example when it is deleted.
  cancelAll(botId: string): void {
    const rows = this.#db.prepare("SELECT id FROM proposals WHERE bot_id = ? AND status = 'pending'").all(botId) as Row[];
    for (const row of rows) this.#settle(String(row.id), "cancelled");
  }

  get(id: string): MemoryProposal {
    const proposal = this.find(id);
    if (proposal === undefined) throw notFound("Proposal");
    return proposal;
  }

  find(id: string): MemoryProposal | undefined {
    const row = this.#db.prepare("SELECT * FROM proposals WHERE id = ?").get(id) as Row | undefined;
    return row === undefined ? undefined : toProposal(row);
  }

  list(filter: { status?: string; botIds: readonly string[] }): MemoryProposal[] {
    const rows = this.#db.prepare("SELECT * FROM proposals ORDER BY created_at DESC LIMIT 500").all() as Row[];
    return rows
      .map(toProposal)
      .filter((proposal) => filter.botIds.includes(proposal.botId))
      .filter((proposal) => filter.status === undefined || proposal.status === filter.status);
  }

  #propose(input: ProposalInput): MemoryProposal {
    assertMayWrite(input.bot, input.file);
    assertWithinLimit(input.file, input.content);
    const id = randomUUID();
    const now = this.#now();
    this.#db
      .prepare(
        `INSERT INTO proposals (id, bot_id, file, content, previous, reason, conversation, status, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      )
      .run(id, input.bot.id, input.file, input.content, this.#files.read(input.bot.id, input.file), input.reason, input.conversation, now, now + input.bot.approvalWaitMs);
    const proposal = this.get(id);
    this.#onChange(proposal);
    return proposal;
  }

  // Waits for the owner, the bot's approval wait to run out, or the bot being stopped, whichever comes first.
  #waitForAnswer(proposal: MemoryProposal, signal: AbortSignal | undefined): Promise<MemoryProposal> {
    if (proposal.status !== "pending") return Promise.resolve(proposal);
    return new Promise((resolve) => {
      const finish = (settled: MemoryProposal) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        this.#waiters.get(proposal.id)?.delete(finish);
        resolve(settled);
      };
      const end = (ending: Ending) => finish(this.#settle(proposal.id, ending) ?? this.get(proposal.id));
      const onAbort = () => end("cancelled");
      const timer = setTimeout(() => end("expired"), Math.max(0, proposal.expiresAt - this.#now()));
      this.#waitersOf(proposal.id).add(finish);
      if (signal?.aborted) onAbort();
      else signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  // Settles a pending proposal and tells everyone waiting on it; undefined when it was already settled.
  #settle(id: string, status: Exclude<MemoryProposal["status"], "pending">): MemoryProposal | undefined {
    const result = this.#db.prepare("UPDATE proposals SET status = ?, answered_at = ? WHERE id = ? AND status = 'pending'").run(status, this.#now(), id);
    if (result.changes === 0) return undefined;
    const settled = this.get(id);
    this.#onChange(settled);
    for (const waiter of [...(this.#waiters.get(id) ?? [])]) waiter(settled);
    this.#waiters.delete(id);
    return settled;
  }

  #waitersOf(id: string): Set<(proposal: MemoryProposal) => void> {
    let waiters = this.#waiters.get(id);
    if (waiters === undefined) this.#waiters.set(id, (waiters = new Set()));
    return waiters;
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
    expiresAt: Number(row.expires_at),
    answeredAt: row.answered_at === null ? null : Number(row.answered_at),
  };
}

import type { Approval, Bot, MemoryEdit } from "@botsman/protocol";
import { ApiError } from "../errors.ts";
import type { ApprovalStore } from "./approval-store.ts";
import { checkBoundary } from "./boundary.ts";

// A tool call the engine asks about before running it.
export type ToolCheck = {
  readonly bot: Bot;
  readonly conversation: string;
  readonly callId: string;
  readonly toolName: string;
  readonly args: Record<string, unknown>;
  readonly signal: AbortSignal | undefined;
  // Durable memory of the approval this call asked for, so a rerun after a crash asks once.
  readonly memo: { load(): Promise<string | undefined>; save(approvalId: string): Promise<string> };
};

export type ToolVerdict = { readonly block?: string };

// The memory edit a tool call asks for, or undefined when it edits no memory file. Throws when the bot may not make it.
export type DescribeMemoryEdit = (bot: Bot, toolName: string, args: Record<string, unknown>) => MemoryEdit | undefined;

// What the owner is asked about.
type Question = { readonly reason: string; readonly description: string; readonly command: string; readonly memoryEdit: MemoryEdit | null };

const ALLOW: ToolVerdict = {};

// Decides whether a tool call runs. Memory edits always ask. Inside the folder a call runs; leaving it follows the bot's permission mode.
export class PermissionPolicy {
  readonly #store: ApprovalStore;
  readonly #describeMemoryEdit: DescribeMemoryEdit;
  readonly #onChange: (approval: Approval) => void;
  readonly #now: () => number;
  readonly #waiters = new Map<string, Set<(approval: Approval) => void>>();

  constructor(store: ApprovalStore, describeMemoryEdit: DescribeMemoryEdit, onChange: (approval: Approval) => void, now: () => number = Date.now) {
    this.#store = store;
    this.#describeMemoryEdit = describeMemoryEdit;
    this.#onChange = onChange;
    this.#now = now;
  }

  async beforeTool(check: ToolCheck): Promise<ToolVerdict> {
    const memoryEdit = this.#memoryEditQuestion(check);
    if (memoryEdit === undefined) return this.#folderDecision(check);
    return "memoryEdit" in memoryEdit ? this.#ask(check, memoryEdit) : memoryEdit;
  }

  // The owner's answer. Allow for this chat also covers later calls of the same tool in the chat, except memory edits.
  answer(id: string, decision: "allow_once" | "allow_chat" | "deny"): Approval {
    if (decision === "allow_chat" && this.#store.get(id).memoryEdit !== null) {
      throw new ApiError(400, "bad_request", "A memory edit can only be allowed once");
    }
    const approval = this.#store.settle(id, { status: decision === "deny" ? "denied" : "allowed", decision });
    if (decision === "allow_chat") this.#store.grant(approval.botId, approval.conversation, approval.toolName);
    this.#settled(approval);
    return approval;
  }

  // Cancels every pending approval of a bot, for example when it is deleted.
  cancelAll(botId: string): void {
    for (const id of this.#store.pendingIds(botId)) this.#settleQuietly(id, "cancelled");
  }

  // A memory edit the bot may make becomes a question; one it may not make is blocked before the owner is asked.
  #memoryEditQuestion(check: ToolCheck): Question | ToolVerdict | undefined {
    try {
      const edit = this.#describeMemoryEdit(check.bot, check.toolName, check.args);
      if (edit === undefined) return undefined;
      const reason = typeof check.args.reason === "string" && check.args.reason !== "" ? check.args.reason : `The bot wants to change ${edit.file}`;
      return { reason, description: `Edit ${edit.file}`, command: JSON.stringify(check.args), memoryEdit: edit };
    } catch (error) {
      return { block: error instanceof Error ? error.message : String(error) };
    }
  }

  async #folderDecision(check: ToolCheck): Promise<ToolVerdict> {
    const boundary = checkBoundary(check.toolName, check.args, check.bot.folder);
    if (!boundary.leaves) return ALLOW;
    if (check.bot.permissionMode === "off") return offDecision();
    if (check.bot.permissionMode === "smart") return smartDecision();
    if (this.#store.hasGrant(check.bot.id, check.conversation, check.toolName)) return ALLOW;
    return this.#ask(check, { reason: boundary.reason, description: boundary.description, command: boundary.command, memoryEdit: null });
  }

  async #ask(check: ToolCheck, question: Question): Promise<ToolVerdict> {
    const approval = await this.#approvalFor(check, question);
    return verdictOf(await this.#waitForAnswer(approval, check.signal));
  }

  async #approvalFor(check: ToolCheck, question: Question): Promise<Approval> {
    const remembered = await check.memo.load();
    const existing = remembered === undefined ? undefined : this.#store.find(remembered);
    if (existing !== undefined) return existing;
    const created = this.#store.create({ ...question, botId: check.bot.id, conversation: check.conversation, callId: check.callId, toolName: check.toolName, args: check.args, waitMs: check.bot.approvalWaitMs });
    await check.memo.save(created.id);
    this.#onChange(created);
    return created;
  }

  // Waits for the owner, the approval wait to run out, or the bot being stopped, whichever comes first.
  #waitForAnswer(approval: Approval, signal: AbortSignal | undefined): Promise<Approval> {
    if (approval.status !== "pending") return Promise.resolve(approval);
    return new Promise((resolve) => {
      const finish = (settled: Approval) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        this.#waiters.get(approval.id)?.delete(finish);
        resolve(settled);
      };
      const onAbort = () => finish(this.#settleQuietly(approval.id, "cancelled"));
      const timer = setTimeout(() => finish(this.#settleQuietly(approval.id, "expired")), Math.max(0, approval.expiresAt - this.#now()));
      this.#waitersOf(approval.id).add(finish);
      if (signal?.aborted) onAbort();
      else signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  #settleQuietly(id: string, status: "expired" | "cancelled"): Approval {
    const current = this.#store.get(id);
    if (current.status !== "pending") return current;
    const settled = this.#store.settle(id, { status, decision: null });
    this.#settled(settled);
    return settled;
  }

  #settled(approval: Approval): void {
    this.#onChange(approval);
    for (const waiter of [...(this.#waiters.get(approval.id) ?? [])]) waiter(approval);
    this.#waiters.delete(approval.id);
  }

  #waitersOf(id: string): Set<(approval: Approval) => void> {
    let waiters = this.#waiters.get(id);
    if (waiters === undefined) this.#waiters.set(id, (waiters = new Set()));
    return waiters;
  }
}

// Off runs every call without asking.
function offDecision(): ToolVerdict {
  return ALLOW;
}

// Smart runs like Off until the classifier exists. Replace this function with the classifier.
function smartDecision(): ToolVerdict {
  return offDecision();
}

function verdictOf(approval: Approval): ToolVerdict {
  if (approval.status === "allowed") return ALLOW;
  if (approval.status === "denied") return { block: "The owner denied this action." };
  if (approval.status === "expired") return { block: "The owner did not answer within the approval wait, so the action was refused." };
  return { block: "The action was cancelled before the owner answered." };
}

import { formatCountdown, memoryDiff, memoryEditText } from "@botsman/client-core";
import { useAction, useApproval, useBot, useBotsmanClient, useNow } from "@botsman/client-core/react";
import type { Approval } from "@botsman/protocol";
import { Button } from "./ui/button.tsx";

// A tool call waiting for the owner: why the bot asks, the full command, the time left, and the answers.
export function ApprovalCard({ approvalId }: { approvalId: string }) {
  const approval = useApproval(approvalId);
  if (approval === undefined) return <p className="text-sm text-muted-foreground">Waiting for your approval…</p>;
  return approval.memoryEdit === null ? <ApprovalDetails approval={approval} /> : <MemoryEditCard approval={approval} />;
}

// A bot asking to change one of its memory files: what it adds and removes, and Confirm or Reject.
function MemoryEditCard({ approval }: { approval: Approval }) {
  const client = useBotsmanClient();
  const now = useNow();
  const bot = useBot(approval.botId);
  const answer = useAction((decision: "allow_once" | "deny") => client.answerApproval(approval.id, decision));
  const edit = approval.memoryEdit!;
  const text = memoryEditText(approval, bot?.name ?? "The bot");
  const lines = memoryDiff(edit.previous, edit.content);
  return (
    <section aria-label="Memory edit" className="flex flex-col gap-3 rounded-xl border border-primary bg-card p-4">
      <header className="flex items-baseline justify-between gap-4">
        <span className="text-xs font-semibold text-primary">Needs you · Memory edit</span>
        <span className="font-mono text-xs text-muted-foreground" title="Time left to answer">
          {formatCountdown(approval.expiresAt, now)}
        </span>
      </header>
      <h3 className="text-base font-semibold">{text.title}</h3>
      <div className="flex max-h-64 flex-col overflow-auto rounded-lg border border-border bg-background py-1 font-mono text-xs">
        {lines.length === 0 ? <span className="px-3 py-0.5 text-muted-foreground">No change</span> : null}
        {lines.map((line, index) => (
          <span key={index} className={`px-3 py-0.5 whitespace-pre-wrap ${line.kind === "added" ? "bg-green/15 text-green" : line.kind === "removed" ? "bg-destructive/15 text-destructive" : "text-muted-foreground"}`}>
            {line.kind === "added" ? "+ " : line.kind === "removed" ? "− " : "  "}
            {line.text}
          </span>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{text.source}</p>
      {answer.error === undefined ? null : <p className="text-sm text-destructive">{answer.error}</p>}
      <div className="flex gap-2">
        <Button variant="primary" disabled={answer.busy} onClick={() => void answer.run("allow_once")}>
          Confirm
        </Button>
        <Button disabled={answer.busy} onClick={() => void answer.run("deny")}>
          Reject
        </Button>
      </div>
    </section>
  );
}

function ApprovalDetails({ approval }: { approval: Approval }) {
  const client = useBotsmanClient();
  const now = useNow();
  const answer = useAction((decision: "allow_once" | "allow_chat" | "deny") => client.answerApproval(approval.id, decision));
  return (
    <section aria-label="Approval" className="flex flex-col gap-3 rounded-xl border border-primary bg-card p-4">
      <header className="flex items-baseline justify-between gap-4">
        <h3 className="font-display text-sm font-bold uppercase text-primary">Needs your approval</h3>
        <span className="font-mono text-xs text-muted-foreground" title="Time left to answer">
          {formatCountdown(approval.expiresAt, now)}
        </span>
      </header>
      <p className="text-sm">{approval.description}</p>
      <p className="text-sm text-muted-foreground">{approval.reason}</p>
      <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-background p-3 font-mono text-xs whitespace-pre-wrap text-green">{approval.command}</pre>
      {answer.error === undefined ? null : <p className="text-sm text-destructive">{answer.error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={answer.busy} onClick={() => void answer.run("allow_once")}>
          Allow once
        </Button>
        <Button disabled={answer.busy} onClick={() => void answer.run("allow_chat")}>
          Allow for this chat
        </Button>
        <Button variant="danger" disabled={answer.busy} onClick={() => void answer.run("deny")}>
          Deny
        </Button>
      </div>
    </section>
  );
}

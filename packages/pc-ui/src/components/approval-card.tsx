import { formatCountdown } from "@botsman/client-core";
import { useAction, useApproval, useBotsmanClient, useNow } from "@botsman/client-core/react";
import type { Approval } from "@botsman/protocol";
import { Button } from "./ui/button.tsx";

// A tool call waiting for the owner: why the bot asks, the full command, the time left, and the answers.
export function ApprovalCard({ approvalId }: { approvalId: string }) {
  const approval = useApproval(approvalId);
  if (approval === undefined) return <p className="text-sm text-muted-foreground">Waiting for your approval…</p>;
  return <ApprovalDetails approval={approval} />;
}

function ApprovalDetails({ approval }: { approval: Approval }) {
  const client = useBotsmanClient();
  const now = useNow();
  const answer = useAction((decision: "allow_once" | "allow_chat" | "deny") => client.answerApproval(approval.id, decision));
  // A memory edit is allowed one at a time, so it has no "for this chat" answer.
  const isMemoryEdit = approval.memoryEdit !== null;
  return (
    <section aria-label="Approval" className="flex flex-col gap-3 rounded-xl border border-primary bg-card p-4">
      <header className="flex items-baseline justify-between gap-4">
        <h3 className="font-display text-sm font-bold uppercase text-primary">{isMemoryEdit ? `Edit ${approval.memoryEdit!.file}` : "Needs your approval"}</h3>
        <span className="font-mono text-xs text-muted-foreground" title="Time left to answer">
          {formatCountdown(approval.expiresAt, now)}
        </span>
      </header>
      <p className="text-sm">{approval.description}</p>
      <p className="text-sm text-muted-foreground">{approval.reason}</p>
      <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-background p-3 font-mono text-xs whitespace-pre-wrap text-green">{isMemoryEdit ? approval.memoryEdit!.content : approval.command}</pre>
      {answer.error === undefined ? null : <p className="text-sm text-destructive">{answer.error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={answer.busy} onClick={() => void answer.run("allow_once")}>
          {isMemoryEdit ? "Allow" : "Allow once"}
        </Button>
        {isMemoryEdit ? null : (
          <Button disabled={answer.busy} onClick={() => void answer.run("allow_chat")}>
            Allow for this chat
          </Button>
        )}
        <Button variant="danger" disabled={answer.busy} onClick={() => void answer.run("deny")}>
          Deny
        </Button>
      </div>
    </section>
  );
}

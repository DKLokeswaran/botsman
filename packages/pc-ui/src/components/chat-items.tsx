import { type ChatController, type ChatItem, formatUsage, type ToolLine } from "@botsman/client-core";
import { ApprovalCard } from "./approval-card.tsx";
import { Markdown } from "./markdown.tsx";
import { Button } from "./ui/button.tsx";

type ItemOf<Kind extends ChatItem["kind"]> = Extract<ChatItem, { kind: Kind }>;

// Draws one item of a chat.
export function ChatItemView({ item, chat, botName }: { item: ChatItem; chat: ChatController; botName: string }) {
  if (item.kind === "user") return <OwnerMessage text={item.text} />;
  if (item.kind === "reply") return <Reply item={item} botName={botName} />;
  if (item.kind === "queued") return <OwnerMessage text={item.text} note={item.mode === "steer" ? "Steering the reply" : "Queued"} muted />;
  if (item.kind === "pending") return <PendingMessage item={item} chat={chat} />;
  if (item.kind === "failure") return <p className="rounded-lg border border-destructive p-3 text-sm text-destructive">{item.text}</p>;
  return <p className="text-center text-xs text-muted-foreground">{item.text}</p>;
}

function OwnerMessage({ text, note, muted = false }: { text: string; note?: string; muted?: boolean }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className={`max-w-[85%] rounded-xl border border-border bg-card px-4 py-2.5 whitespace-pre-wrap ${muted ? "opacity-60" : ""}`}>{text}</div>
      {note === undefined ? null : <span className="text-xs text-muted-foreground">{note}</span>}
    </div>
  );
}

function PendingMessage({ item, chat }: { item: ItemOf<"pending">; chat: ChatController }) {
  if (item.failed === undefined) return <OwnerMessage text={item.text} note="Sending…" muted />;
  return (
    <div className="flex flex-col items-end gap-1">
      <OwnerMessage text={item.text} muted />
      <div className="flex items-center gap-2 text-xs text-destructive">
        <span>{item.failed}</span>
        <Button variant="text" className="px-2 py-0.5 text-xs" onClick={() => void chat.retry(item.id)}>
          Retry
        </Button>
        <Button variant="text" className="px-2 py-0.5 text-xs" onClick={() => chat.discard(item.id)}>
          Discard
        </Button>
      </div>
    </div>
  );
}

function Reply({ item, botName }: { item: ItemOf<"reply">; botName: string }) {
  return (
    <article className="flex flex-col gap-2">
      <div className="font-display text-sm font-bold uppercase">{botName}</div>
      {item.thinking === "" ? null : <Thinking text={item.thinking} open={item.streaming && item.text === ""} />}
      {item.tools.map((tool) => (
        <ToolLineView key={tool.callId} tool={tool} />
      ))}
      {item.text === "" ? null : <Markdown text={item.text} />}
      {item.streaming && item.text === "" && item.thinking === "" && item.tools.length === 0 ? <p className="text-sm text-muted-foreground">Working…</p> : null}
      {item.error === null ? null : <p className="text-sm text-destructive">{item.error}</p>}
      {item.usage === null ? null : <div className="text-xs text-muted-foreground">{formatUsage(item.usage)}</div>}
    </article>
  );
}

function Thinking({ text, open }: { text: string; open: boolean }) {
  return (
    <details open={open} className="text-sm text-muted-foreground">
      <summary className="cursor-pointer select-none">{open ? "Thinking" : "Thought"}</summary>
      <p className="mt-1 border-l border-border pl-3 whitespace-pre-wrap">{text}</p>
    </details>
  );
}

const TOOL_VERBS: Record<ToolLine["status"], string> = { waiting: "Waiting", running: "Running", done: "Ran", failed: "Failed" };

// One tool call: a line that opens to its output, and the approval card while it waits for the owner.
function ToolLineView({ tool }: { tool: ToolLine }) {
  return (
    <div className="flex flex-col gap-2">
      <details className="text-sm text-muted-foreground">
        <summary className={`cursor-pointer select-none ${tool.status === "failed" ? "text-destructive" : ""}`}>
          {TOOL_VERBS[tool.status]}: <span className="font-mono text-xs">{tool.summary}</span>
        </summary>
        {tool.output === "" ? null : <pre className="mt-1 max-h-64 overflow-auto rounded-lg border border-border bg-card p-3 font-mono text-xs whitespace-pre-wrap">{tool.output}</pre>}
      </details>
      {tool.approvalId === undefined ? null : <ApprovalCard approvalId={tool.approvalId} />}
    </div>
  );
}

import { type ChatController, type ChatItem, formatUsage, messageTime, queuedNote, type RunItem, type RunStep, runText, showsWorking, type ToolLine, toolVerb, workLabel } from "@botsman/client-core";

type WorkStep = Extract<RunStep, { kind: "work" }>;
import { useAction, useCopied } from "@botsman/client-core/react";
import { ApprovalCard } from "./approval-card.tsx";
import { Markdown } from "./markdown.tsx";
import { Button } from "./ui/button.tsx";

type ItemOf<Kind extends ChatItem["kind"]> = Extract<ChatItem, { kind: Kind }>;

// Draws one item of a chat.
export function ChatItemView({ item, chat, botName }: { item: ChatItem; chat: ChatController; botName: string }) {
  if (item.kind === "user") return <OwnerMessage text={item.text} note={messageTime(item.at)} />;
  if (item.kind === "run") return <Run item={item} botName={botName} />;
  if (item.kind === "queued") return <OwnerMessage text={item.text} note={queuedNote(item.mode)} muted />;
  if (item.kind === "pending") return <PendingMessage item={item} chat={chat} />;
  if (item.kind === "failure") return <Failure text={item.text} chat={chat} />;
  return <p className="text-center text-xs text-muted-foreground">{item.text}</p>;
}

function OwnerMessage({ text, note, muted = false }: { text: string; note?: string | undefined; muted?: boolean }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className={`max-w-[85%] rounded-xl border border-border bg-card px-4 py-2.5 whitespace-pre-wrap ${muted ? "opacity-60" : ""}`}>{text}</div>
      {note === undefined ? null : <span className="text-xs text-muted-foreground">{note}</span>}
    </div>
  );
}

// A reply that failed, with a way to ask the model again.
function Failure({ text, chat }: { text: string; chat: ChatController }) {
  const retry = useAction(() => chat.retryReply());
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-destructive p-3 text-sm text-destructive">
      <p>{text}</p>
      {retry.error === undefined ? null : <p className="text-xs">{retry.error}</p>}
      <Button variant="text" className="self-start px-2 py-0.5 text-xs" disabled={retry.busy} onClick={() => void retry.run()}>
        Retry
      </Button>
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

// One run: the bot's replies in order, with the thinking and tool calls between them folded away, and the run's
// total cost at the end. An approval stays in view, outside its fold.
function Run({ item, botName }: { item: RunItem; botName: string }) {
  return (
    <article className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-sm font-bold uppercase">{botName}</span>
        <span className="text-xs text-muted-foreground">{messageTime(item.at)}</span>
      </div>
      {item.steps.map((step, index) =>
        step.kind === "text" ? <Markdown key={step.id} text={step.text} /> : <WorkFold key={step.id} step={step} live={item.working && index === item.steps.length - 1} />,
      )}
      {showsWorking(item) ? <p className="animate-pulse text-sm text-muted-foreground">Working…</p> : null}
      {item.error === null ? null : <p className="text-sm text-destructive">{item.error}</p>}
      {item.working ? null : <RunFooter item={item} />}
    </article>
  );
}

// Under a finished run: its tokens and cost, and Copy for everything it said.
function RunFooter({ item }: { item: RunItem }) {
  const { copied, copy } = useCopied((text) => navigator.clipboard.writeText(text));
  const text = runText(item);
  if (item.usage === null && text === "") return null;
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      {item.usage === null ? null : <span>{formatUsage(item.usage)}</span>}
      {text === "" ? null : (
        <button type="button" className="rounded-md px-1.5 py-0.5 font-semibold hover:bg-accent hover:text-foreground" onClick={() => void copy(text)}>
          {copied ? "Copied" : "Copy"}
        </button>
      )}
    </div>
  );
}

// Thinking and tool calls between two replies, folded into one line.
function WorkFold({ step, live }: { step: WorkStep; live: boolean }) {
  return (
    <>
      <details className="text-sm text-muted-foreground">
        <summary className={`cursor-pointer select-none ${live ? "animate-pulse" : ""}`}>{workLabel(step, live)}</summary>
        <div className="mt-2 flex flex-col gap-2 border-l border-border pl-3">
          {step.thinking === "" ? null : <p className="whitespace-pre-wrap">{step.thinking}</p>}
          {step.tools.map((tool) => (
            <ToolLineView key={tool.callId} tool={tool} />
          ))}
        </div>
      </details>
      {step.tools.flatMap((tool) => (tool.approvalId === undefined ? [] : [<ApprovalCard key={tool.approvalId} approvalId={tool.approvalId} />]))}
    </>
  );
}

// One tool call: a line that opens to its output.
function ToolLineView({ tool }: { tool: ToolLine }) {
  return (
    <details className="text-sm text-muted-foreground">
      <summary className={`cursor-pointer select-none ${tool.status === "failed" ? "text-destructive" : ""}`}>
        {toolVerb(tool.status)}: <span className="font-mono text-xs">{tool.summary}</span>
      </summary>
      {tool.output === "" ? null : <pre className="mt-1 max-h-64 overflow-auto rounded-lg border border-border bg-card p-3 font-mono text-xs whitespace-pre-wrap">{tool.output}</pre>}
    </details>
  );
}

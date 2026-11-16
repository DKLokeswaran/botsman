import { characterCount, MEMORY_FILES, memoryAudience, pendingMemoryEdits } from "@botsman/client-core";
import { useAction, useBot, useBotsmanClient, useMemory, useNeedsYou } from "@botsman/client-core/react";
import type { MemoryFile, MemoryFileName } from "@botsman/protocol";
import { useState } from "react";
import { ApprovalCard } from "../components/approval-card.tsx";
import { ErrorText, Page } from "../components/page.tsx";
import { Button } from "../components/ui/button.tsx";
import { ReadOnlyText } from "../components/read-only-text.tsx";
import { botInfoHref } from "../use-route.ts";

// The four memory files a bot loads, with its memory edits waiting for the owner.
export function MemoryScreen({ botId }: { botId: string }) {
  const bot = useBot(botId);
  const memory = useMemory(botId);
  const pending = pendingMemoryEdits(useNeedsYou(), botId);
  const [open, setOpen] = useState<MemoryFileName>("BOT_PROFILE.md");
  const [savedFile, setSavedFile] = useState<MemoryFileName>();
  if (bot === undefined) return <p className="p-6 text-muted-foreground">This bot no longer exists.</p>;
  const file = memory.value?.files.find((candidate) => candidate.name === open);
  const info = MEMORY_FILES.find((candidate) => candidate.name === open)!;
  return (
    <Page title="Memory" subtitle={bot.name} back={botInfoHref(bot.id)}>
      {pending.map((approval) => (
        <ApprovalCard key={approval.id} approvalId={approval.id} />
      ))}
      <div role="tablist" aria-label="Memory file" className="flex flex-wrap gap-1 rounded-lg border border-border p-0.5">
        {MEMORY_FILES.map((candidate) => (
          <button key={candidate.name} type="button" role="tab" aria-selected={candidate.name === open} onClick={() => setOpen(candidate.name)} className={`flex-1 rounded-md px-2 py-1.5 font-mono text-xs ${candidate.name === open ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
            {candidate.name}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{info.about}</p>
      <ErrorText>{memory.error}</ErrorText>
      {file === undefined ? <p className="text-sm text-muted-foreground">Loading…</p> : <FileEditor key={`${file.name}\n${file.content}`} botId={bot.id} file={file} label={`${file.name} · ${memoryAudience(info.shared, bot.name)}`} saved={savedFile === file.name} onSaved={() => (setSavedFile(file.name), memory.reload())} onEdit={() => setSavedFile(undefined)} />}
    </Page>
  );
}

// A memory file shown as it reads, with Edit to change it. Saving or cancelling returns to reading.
function FileEditor({ botId, file, label, saved, onSaved, onEdit }: { botId: string; file: MemoryFile; label: string; saved: boolean; onSaved: () => void; onEdit: () => void }) {
  const client = useBotsmanClient();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(file.content);
  const save = useAction(async () => {
    await client.saveMemory(botId, file.name, text);
    onSaved();
  });
  const over = text.length > file.limit;
  const cancel = () => (setText(file.content), setEditing(false));
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      {editing ? (
        <textarea rows={14} aria-label={label} className="rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:border-ring" value={text} onChange={(event) => (setText(event.target.value), onEdit())} />
      ) : (
        <ReadOnlyText text={file.content} />
      )}
      <p className={`text-xs ${over ? "text-destructive" : "text-muted-foreground"}`}>{characterCount(text.length, file.limit)}</p>
      <ErrorText>{save.error}</ErrorText>
      {saved && !editing ? <p className="text-xs text-muted-foreground">Saved. Each bot gets the change with its next message.</p> : null}
      <div className="flex gap-2">
        {editing ? (
          <>
            <Button variant="primary" disabled={over || text === file.content || save.busy} onClick={() => void save.run()}>
              Save
            </Button>
            <Button variant="text" onClick={cancel}>
              Cancel
            </Button>
          </>
        ) : (
          <Button onClick={() => setEditing(true)}>Edit</Button>
        )}
      </div>
    </div>
  );
}

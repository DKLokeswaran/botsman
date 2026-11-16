import { newNoteName, noteNameProblem } from "@botsman/client-core";
import { useAction, useBot, useBotsmanClient, useNotes } from "@botsman/client-core/react";
import type { Note } from "@botsman/protocol";
import { useEffect, useState } from "react";
import { ErrorText, Page } from "../components/page.tsx";
import { Button } from "../components/ui/button.tsx";
import { ReadOnlyText } from "../components/read-only-text.tsx";
import { Field } from "../components/ui/field.tsx";
import { botInfoHref, noteHref, notesHref } from "../use-route.ts";

// A bot's notes, with keyword search.
export function NotesScreen({ botId }: { botId: string }) {
  const bot = useBot(botId);
  const [query, setQuery] = useState("");
  const notes = useNotes(botId, query);
  if (bot === undefined) return <p className="p-6 text-muted-foreground">This bot no longer exists.</p>;
  const all = notes.value?.notes ?? [];
  const rows = notes.value?.hits?.map((hit) => ({ name: hit.name, detail: hit.snippet })) ?? all.map((note) => ({ name: note.name, detail: `${note.size.toLocaleString("en-US")} bytes` }));
  return (
    <Page title="Notes" subtitle={bot.name} back={botInfoHref(bot.id)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Longer records this bot keeps. A bot opens a note only when it needs it, and its edits here don't ask you.</p>
        <Button variant="primary" onClick={() => (window.location.hash = noteHref(bot.id, newNoteName(all.map((note) => note.name))))}>
          New note
        </Button>
      </div>
      <Field label="Search" placeholder="Search by keyword" value={query} onChange={(event) => setQuery(event.target.value)} />
      <ErrorText>{notes.error}</ErrorText>
      {notes.value !== undefined && rows.length === 0 ? <p className="text-sm text-muted-foreground">{query.trim() === "" ? "No notes yet." : "No note matches that."}</p> : null}
      {rows.map((row) => (
        <a key={row.name} href={noteHref(bot.id, row.name)} className="flex flex-col rounded-lg border border-border px-3 py-2.5 hover:bg-accent">
          <span className="text-sm font-semibold">{row.name}</span>
          <span className="truncate text-xs text-muted-foreground">{row.detail}</span>
        </a>
      ))}
    </Page>
  );
}

// One note to read, edit, rename, or delete. A name with no file yet starts a new note.
export function NoteScreen({ botId, name }: { botId: string; name: string }) {
  const client = useBotsmanClient();
  const bot = useBot(botId);
  const [loaded, setLoaded] = useState<Note | null>();
  useEffect(() => {
    client.note(botId, name).then(setLoaded, () => setLoaded(null));
  }, [client, botId, name]);
  if (bot === undefined) return <p className="p-6 text-muted-foreground">This bot no longer exists.</p>;
  return (
    <Page title={name} subtitle={`${bot.name} · Notes`} back={notesHref(bot.id)}>
      {loaded === undefined ? <p className="text-sm text-muted-foreground">Loading…</p> : <NoteEditor botId={bot.id} name={name} content={loaded?.content ?? ""} isNew={loaded === null} />}
    </Page>
  );
}

// A note shown as it reads, with Edit and Delete. A new note opens ready to write.
function NoteEditor({ botId, name, content, isNew }: { botId: string; name: string; content: string; isNew: boolean }) {
  const client = useBotsmanClient();
  const [editing, setEditing] = useState(isNew);
  const [saved, setSaved] = useState(content);
  const [fileName, setFileName] = useState(name);
  const [text, setText] = useState(content);
  const [asking, setAsking] = useState(false);
  const problem = noteNameProblem(fileName);
  const save = useAction(async () => {
    await client.saveNote(botId, fileName, text, isNew ? undefined : name);
    setSaved(text);
    setEditing(false);
    window.location.hash = noteHref(botId, fileName);
  });
  const remove = useAction(async () => {
    await client.deleteNote(botId, name);
    window.location.hash = notesHref(botId);
  });
  if (!editing)
    return (
      <div className="flex flex-col gap-3">
        <ReadOnlyText text={saved} />
        <ErrorText>{remove.error}</ErrorText>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setEditing(true)}>Edit</Button>
          {asking ? (
            <>
              <Button variant="danger" disabled={remove.busy} onClick={() => void remove.run()}>
                Delete this note
              </Button>
              <Button variant="text" onClick={() => setAsking(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="danger" onClick={() => setAsking(true)}>
              Delete
            </Button>
          )}
        </div>
      </div>
    );
  return (
    <div className="flex flex-col gap-3">
      <Field label="File name" spellCheck={false} value={fileName} onChange={(event) => setFileName(event.target.value)} />
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Text</span>
        <textarea rows={16} className="rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:border-ring" value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      <ErrorText>{problem ?? save.error}</ErrorText>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={problem !== undefined || save.busy} onClick={() => void save.run()}>
          Save
        </Button>
        {isNew ? null : (
          <Button variant="text" onClick={() => (setText(saved), setFileName(name), setEditing(false))}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

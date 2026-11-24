import type { MemoryFile, MemoryFileName, MemoryFiles, Note, NoteInfo, NoteSearchHit } from "@botsman/protocol";
import { useEffect, useState } from "react";
import { MEMORY_FILES, newNoteName, noteNameProblem, pendingMemoryEdits } from "../memory-notes.ts";
import { useBotsmanClient } from "./client-context.tsx";
import { useNeedsYou } from "./use-server-state.ts";
import { useAction } from "./use-action.ts";
import { type Loaded, useLoaded } from "./use-loaded.ts";

const SEARCH_DELAY_MS = 300;

// A bot's four memory files, loaded again whenever one of its memory edits is answered.
function useMemory(botId: string): Loaded<MemoryFiles> {
  const client = useBotsmanClient();
  const pending = pendingMemoryEdits(useNeedsYou(), botId).length;
  return useLoaded(() => client.memory(botId), [client, botId, pending]);
}

// A bot's notes, or the notes matching a keyword search once the owner stops typing.
function useNotes(botId: string, query: string): Loaded<{ notes: NoteInfo[]; hits: NoteSearchHit[] | undefined }> {
  const client = useBotsmanClient();
  const search = query.trim();
  return useLoaded(
    async () => ({ notes: await client.notes(botId), hits: search === "" ? undefined : await client.searchNotes(botId, search) }),
    [client, botId, search],
    search === "" ? 0 : SEARCH_DELAY_MS,
  );
}

// The memory screen: a bot's files, the one open and what it is for, its memory edits waiting for the owner, and whether
// the open file was just saved, so the screen can say so until the owner edits again.
export function useMemoryScreen(botId: string) {
  const memory = useMemory(botId);
  const pending = pendingMemoryEdits(useNeedsYou(), botId);
  const [open, setOpen] = useState<MemoryFileName>("BOT_PROFILE.md");
  const [savedFile, setSavedFile] = useState<MemoryFileName>();
  const file = memory.value?.files.find((candidate) => candidate.name === open);
  const info = MEMORY_FILES.find((candidate) => candidate.name === open)!;
  const onSaved = () => (setSavedFile(open), memory.reload());
  return { memory, pending, open, setOpen, file, info, saved: file !== undefined && savedFile === file.name, onSaved, onEdit: () => setSavedFile(undefined) };
}

// One memory file, shown as it reads until Edit. Saving or cancelling returns to reading.
export function useMemoryEditor(botId: string, file: MemoryFile, onSaved: () => void) {
  const client = useBotsmanClient();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(file.content);
  const save = useAction(async () => {
    await client.saveMemory(botId, file.name, text);
    onSaved();
  });
  const over = text.length > file.limit;
  const cancel = () => (setText(file.content), setEditing(false));
  return { editing, startEditing: () => setEditing(true), text, setText, over, canSave: !over && text !== file.content && !save.busy, save, cancel };
}

// The notes screen: a row per note, or per search hit while searching, the line to show when there are none, and a free
// name for a new note.
export function useNoteList(botId: string) {
  const [query, setQuery] = useState("");
  const notes = useNotes(botId, query);
  const all = notes.value?.notes ?? [];
  const rows = notes.value?.hits?.map((hit) => ({ name: hit.name, detail: hit.snippet })) ?? all.map((note) => ({ name: note.name, detail: `${note.size.toLocaleString("en-US")} bytes` }));
  const emptyText = notes.value === undefined || rows.length > 0 ? undefined : query.trim() === "" ? "No notes yet." : "No note matches that.";
  return { query, setQuery, error: notes.error, rows, emptyText, newName: () => newNoteName(all.map((note) => note.name)) };
}

// One note, null when no note has that name yet, or undefined while it loads.
export function useNote(botId: string, name: string): Note | null | undefined {
  const client = useBotsmanClient();
  const [note, setNote] = useState<Note | null>();
  useEffect(() => {
    client.note(botId, name).then(setNote, () => setNote(null));
  }, [client, botId, name]);
  return note;
}

// A note shown as it reads, with Edit and Delete. A new note opens ready to write. `onSaved` gets the name it was saved
// under, and `onDeleted` runs after a delete, so each app moves to the right screen.
export function useNoteEditor(botId: string, name: string, content: string, isNew: boolean, onSaved: (fileName: string) => void, onDeleted: () => void) {
  const client = useBotsmanClient();
  const [editing, setEditing] = useState(isNew);
  const [saved, setSaved] = useState(content);
  // The name the note has on the server, or undefined while a new note isn't saved yet.
  const [savedName, setSavedName] = useState(isNew ? undefined : name);
  const [fileName, setFileName] = useState(name);
  const [text, setText] = useState(content);
  const [asking, setAsking] = useState(false);
  const save = useAction(async () => {
    await client.saveNote(botId, fileName, text, savedName);
    setSaved(text);
    setSavedName(fileName);
    setEditing(false);
    onSaved(fileName);
  });
  const remove = useAction(async () => {
    await client.deleteNote(botId, savedName ?? name);
    onDeleted();
  });
  const cancel = () => (setText(saved), setFileName(savedName ?? name), setEditing(false));
  return { editing, startEditing: () => setEditing(true), saved, fileName, setFileName, text, setText, problem: noteNameProblem(fileName), save, cancel, asking, setAsking, remove };
}

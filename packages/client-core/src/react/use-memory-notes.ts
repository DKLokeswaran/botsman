import type { MemoryFiles, NoteInfo, NoteSearchHit } from "@botsman/protocol";
import { type Loaded, useLoaded } from "./use-loaded.ts";
import { pendingMemoryEdits } from "../memory-notes.ts";
import { useBotsmanClient } from "./client-context.tsx";
import { useNeedsYou } from "./hooks.ts";

const SEARCH_DELAY_MS = 300;

// A bot's four memory files, loaded again whenever one of its memory edits is answered.
export function useMemory(botId: string): Loaded<MemoryFiles> {
  const client = useBotsmanClient();
  const pending = pendingMemoryEdits(useNeedsYou(), botId).length;
  return useLoaded(() => client.memory(botId), [client, botId, pending]);
}

// A bot's notes, or the notes matching a keyword search once the owner stops typing.
export function useNotes(botId: string, query: string): Loaded<{ notes: NoteInfo[]; hits: NoteSearchHit[] | undefined }> {
  const client = useBotsmanClient();
  const search = query.trim();
  return useLoaded(
    async () => ({ notes: await client.notes(botId), hits: search === "" ? undefined : await client.searchNotes(botId, search) }),
    [client, botId, search],
    search === "" ? 0 : SEARCH_DELAY_MS,
  );
}

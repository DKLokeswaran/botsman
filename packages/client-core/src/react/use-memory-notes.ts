import type { MemoryFiles, NoteInfo, NoteSearchHit } from "@botsman/protocol";
import { useCallback, useEffect, useState } from "react";
import { pendingMemoryEdits } from "../memory-notes.ts";
import { useBotsmanClient } from "./client-context.tsx";
import { useNeedsYou } from "./hooks.ts";

const SEARCH_DELAY_MS = 300;

type Loaded<T> = { value: T | undefined; error: string | undefined; reload: () => void };

// Loads something from the server when its inputs change, and on `reload`.
function useLoaded<T>(load: () => Promise<T>, inputs: readonly unknown[], delayMs = 0): Loaded<T> {
  const [value, setValue] = useState<T>();
  const [error, setError] = useState<string>();
  const [round, setRound] = useState(0);
  const reload = useCallback(() => setRound((current) => current + 1), []);
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      load()
        .then((result) => current && (setValue(result), setError(undefined)))
        .catch((caught: unknown) => current && setError(caught instanceof Error ? caught.message : "Couldn't load"));
    }, delayMs);
    return () => {
      current = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...inputs, round]);
  return { value, error, reload };
}

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

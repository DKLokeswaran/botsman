import type { FreeSpace, ModelInfo } from "@botsman/protocol";
import { useBotsmanClient } from "./client-context.tsx";
import { useServerState } from "./hooks.ts";
import { useLoaded } from "./use-loaded.ts";

const FOLDER_CHECK_DELAY_MS = 400;

// Models from every connected provider, loaded again when a provider is connected or removed. A failed load shows none.
export function useModels(): { models: ModelInfo[]; loading: boolean; error: string | undefined } {
  const client = useBotsmanClient();
  const { providersVersion } = useServerState();
  const { value, error } = useLoaded(() => client.models(), [client, providersVersion]);
  return { models: error === undefined ? (value ?? []) : [], loading: value === undefined && error === undefined, error };
}

// Free space for a folder the owner is typing, checked shortly after they stop. A failed check shows nothing.
export function useFreeSpace(path: string): FreeSpace | undefined {
  const client = useBotsmanClient();
  return useLoaded(() => client.freeSpace(path).catch(() => undefined), [client, path], FOLDER_CHECK_DELAY_MS).value;
}

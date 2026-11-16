import type { FreeSpace, ModelInfo } from "@botsman/protocol";
import { useEffect, useState } from "react";
import { useBotsmanClient } from "./client-context.tsx";
import { useServerState } from "./hooks.ts";

const FOLDER_CHECK_DELAY_MS = 400;

// Models from every connected provider, loaded again when a provider is connected or removed.
export function useModels(): { models: ModelInfo[]; loading: boolean; error: string | undefined } {
  const client = useBotsmanClient();
  const { providersVersion } = useServerState();
  const [result, setResult] = useState<{ models: ModelInfo[]; loading: boolean; error: string | undefined }>({ models: [], loading: true, error: undefined });
  useEffect(() => {
    let current = true;
    client
      .models()
      .then((models) => current && setResult({ models, loading: false, error: undefined }))
      .catch((error: unknown) => current && setResult({ models: [], loading: false, error: error instanceof Error ? error.message : "Couldn't load models" }));
    return () => {
      current = false;
    };
  }, [client, providersVersion]);
  return result;
}

// Free space for a folder the owner is typing, checked shortly after they stop.
export function useFreeSpace(path: string): FreeSpace | undefined {
  const client = useBotsmanClient();
  const [space, setSpace] = useState<FreeSpace>();
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      client
        .freeSpace(path)
        .then((result) => current && setSpace(result))
        .catch(() => current && setSpace(undefined));
    }, FOLDER_CHECK_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [client, path]);
  return space;
}

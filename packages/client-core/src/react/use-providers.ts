import type { Provider, ProviderLogin } from "@botsman/protocol";
import { useEffect, useState } from "react";
import { useBotsmanClient } from "./client-context.tsx";
import { useServerState } from "./hooks.ts";

// Every provider and whether it is connected, loaded again when one is connected or removed.
export function useProviders(): { providers: Provider[] | undefined; error: string | undefined } {
  const client = useBotsmanClient();
  const { providersVersion } = useServerState();
  const [result, setResult] = useState<{ providers: Provider[] | undefined; error: string | undefined }>({ providers: undefined, error: undefined });
  useEffect(() => {
    let current = true;
    client.providers().then(
      (providers) => current && setResult({ providers, error: undefined }),
      (error: unknown) => current && setResult({ providers: undefined, error: error instanceof Error ? error.message : "Couldn't load providers" }),
    );
    return () => {
      current = false;
    };
  }, [client, providersVersion]);
  return result;
}

// A sign-in as the server stream last described it.
export function useLogin(loginId: string | undefined): ProviderLogin | undefined {
  const { logins } = useServerState();
  return loginId === undefined ? undefined : logins[loginId];
}

import type { Provider, ProviderLogin } from "@botsman/protocol";
import { useBotsmanClient } from "./client-context.tsx";
import { useServerState } from "./hooks.ts";
import { useLoaded } from "./use-loaded.ts";

// Every provider and whether it is connected, loaded again when one is connected or removed. A failed load shows none.
export function useProviders(): { providers: Provider[] | undefined; error: string | undefined } {
  const client = useBotsmanClient();
  const { providersVersion } = useServerState();
  const { value, error } = useLoaded(() => client.providers(), [client, providersVersion]);
  return { providers: error === undefined ? value : undefined, error };
}

// A sign-in as the server stream last described it.
export function useLogin(loginId: string | undefined): ProviderLogin | undefined {
  const { logins } = useServerState();
  return loginId === undefined ? undefined : logins[loginId];
}

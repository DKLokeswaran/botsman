import type { Health } from "@botsman/protocol";
import { useCallback, useState } from "react";
import { ApiClient, type Fetch } from "../api-client.ts";

export type ServerHealthState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "reached"; baseUrl: string; health: Health }
  | { status: "failed"; message: string };

// Asks a server address for its health, so a screen can show whether it is a working Botsman server.
export function useServerHealth(fetch: Fetch): { state: ServerHealthState; check: (address: string) => Promise<void> } {
  const [state, setState] = useState<ServerHealthState>({ status: "idle" });
  const check = useCallback(
    async (address: string) => {
      setState({ status: "checking" });
      const client = new ApiClient({ baseUrl: address, fetch });
      try {
        setState({ status: "reached", baseUrl: client.baseUrl, health: await client.health() });
      } catch (error) {
        setState({ status: "failed", message: error instanceof Error ? error.message : "Something went wrong" });
      }
    },
    [fetch],
  );
  return { state, check };
}

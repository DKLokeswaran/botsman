import type { DeviceSession, UsageReport } from "@botsman/protocol";
import { useBotsmanClient } from "./client-context.tsx";
import { type Loaded, useLoaded } from "./use-loaded.ts";

// Spending over the last `days` days.
export function useUsage(days: number): Loaded<UsageReport> {
  const client = useBotsmanClient();
  return useLoaded(() => client.usage(days), [client, days]);
}

// Every signed-in device, with this one marked.
export function useSessions(): Loaded<DeviceSession[]> {
  const client = useBotsmanClient();
  return useLoaded(() => client.sessions(), [client]);
}

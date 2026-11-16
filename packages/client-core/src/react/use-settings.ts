import type { AlertSettings, DeviceSession, UsageReport } from "@botsman/protocol";
import { liveSessions } from "../settings-view.ts";
import { useBotsmanClient } from "./client-context.tsx";
import { useServerState } from "./hooks.ts";
import { type Action, useAction } from "./use-action.ts";
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

// The devices still signed in, this one first, and signing one of them out.
export function useDevices(): { devices: DeviceSession[] | undefined; error: string | undefined; revoke: Action<[string]> } {
  const client = useBotsmanClient();
  const sessions = useSessions();
  const revoke = useAction(async (sessionId: string) => {
    await client.revokeSession(sessionId);
    sessions.reload();
  });
  return { devices: sessions.value === undefined ? undefined : liveSessions(sessions.value), error: sessions.error ?? revoke.error, revoke };
}

// The server's alert switches, undefined on a server that doesn't keep them, and turning one on or off.
export function useAlertSettings(): { alertSettings: AlertSettings | undefined; save: Action<[string, boolean]> } {
  const client = useBotsmanClient();
  const { alertSettings } = useServerState();
  const save = useAction((kind: string, on: boolean) => client.updateAlertSettings({ [kind]: on }));
  return { alertSettings, save };
}

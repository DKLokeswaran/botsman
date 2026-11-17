import type { AlertKind, DeviceSession } from "@botsman/protocol";
import type { BackgroundStatus } from "./background-alerts.ts";
import { formatMessageTime } from "./format.ts";

// The alert kinds that can happen today, as settings lists them. Routine, question, channel, and skill alerts arrive
// with the milestones that add them.
export const ALERT_CHOICES: readonly { kind: AlertKind; label: string; detail: string }[] = [
  { kind: "approval", label: "Approvals", detail: "A bot asks before an action or a memory edit" },
  { kind: "failure", label: "Failures", detail: "A reply stops with an error" },
];

// Signed-in devices that still work, this one first, then the most recently used.
export function liveSessions(sessions: readonly DeviceSession[]): DeviceSession[] {
  return sessions.filter((session) => session.revokedAt === null).sort((a, b) => Number(b.current === true) - Number(a.current === true) || b.lastUsedAt - a.lastUsedAt);
}

// The line under a device in the signed-in list.
export function deviceDetail(session: DeviceSession, now = Date.now()): string {
  return session.current ? "This device" : `Last used ${formatMessageTime(session.lastUsedAt, now)}`;
}

export type BackgroundStep = { label: string; detail: string; action: "notifications" | "battery" | "guide" | undefined };

// Phone makers known to stop background apps, by the name Android reports, with their dontkillmyapp.com page.
const STRICT_MAKERS: Record<string, string> = { samsung: "Samsung", xiaomi: "Xiaomi", oneplus: "OnePlus", huawei: "Huawei", oppo: "Oppo", vivo: "Vivo", realme: "Realme" };

// What keeps the background connection alive on this phone: notifications allowed, no battery limits, and the
// maker's own steps where the maker is known to stop background apps.
export function backgroundSteps(status: BackgroundStatus): BackgroundStep[] {
  const steps: BackgroundStep[] = [];
  if (status.notificationsAllowed !== null)
    steps.push({ label: "Notifications", detail: status.notificationsAllowed ? "Allowed" : "Turned off for Botsman", action: status.notificationsAllowed ? undefined : "notifications" });
  if (status.batteryUnrestricted !== null)
    steps.push({ label: "Battery", detail: status.batteryUnrestricted ? "Unrestricted" : "Android may pause the connection to save battery", action: status.batteryUnrestricted ? undefined : "battery" });
  const maker = status.maker === null ? undefined : STRICT_MAKERS[status.maker];
  if (maker !== undefined) steps.push({ label: "Phone maker", detail: `${maker} can stop background apps. Its steps are on dontkillmyapp.com.`, action: "guide" });
  return steps;
}

// The dontkillmyapp.com page for a phone maker.
export function makerGuide(maker: string | null): string {
  return `https://dontkillmyapp.com/${maker ?? ""}`;
}

// The connection's state in a few words.
export function backgroundLine(status: BackgroundStatus, enabled: boolean): string {
  if (!enabled) return "Off. Alerts arrive only while the app is open.";
  if (!status.running) return "Starts when you sign in.";
  return status.connected ? "Connected. An ongoing notification shows while it runs." : "Connecting…";
}

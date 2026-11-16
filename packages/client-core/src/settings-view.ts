import type { AlertKind, DeviceSession } from "@botsman/protocol";

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

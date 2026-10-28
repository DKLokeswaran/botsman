/**
 * Identity of a transcript row.
 * History merge learns a row id for the same text. That must not remount the row,
 * or a user line that is expanded snaps back to Show more.
 * The id is an argument so callers pass it and tests can prove it is ignored.
 */
export function chatLineKey(sessionId: string | null, index: number, role: string, messageId: string): string {
  void messageId;
  return `${sessionId}-${index}-${role}`;
}

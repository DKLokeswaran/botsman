import { type Approval, type MemoryFileName, NOTE_NAME_PATTERN, NoteNameLimits } from "@botsman/protocol";

// The memory screen's files: each one's tab label, what it holds and who writes it. The labels leave out `.md` to fit a
// phone's width.
export const MEMORY_FILES: readonly { name: MemoryFileName; label: string; about: string; shared: boolean }[] = [
  { name: "USER_PROFILE.md", label: "USER PROFILE", about: "About you, for every bot. Only you write this.", shared: true },
  { name: "USER_MEMORY.md", label: "USER MEMORY", about: "What the bots have learned about you. Only the main bot writes this, and every edit asks you first. Other bots ask the main bot to record things.", shared: true },
  { name: "BOT_PROFILE.md", label: "BOT PROFILE", about: "This bot's purpose and instructions. Only you write this.", shared: false },
  { name: "BOT_MEMORY.md", label: "BOT MEMORY", about: "What this bot keeps for itself. Every edit it makes asks you first.", shared: false },
];

// Who sees a file: every bot, or only this one.
export function memoryAudience(shared: boolean, botName: string): string {
  return shared ? "Shared by every bot" : `Only ${botName}`;
}

// A character count against the file's limit, such as "1,204 / 4,000 characters".
export function characterCount(length: number, limit: number): string {
  return `${length.toLocaleString("en-US")} / ${limit.toLocaleString("en-US")} characters`;
}

// Memory edits from this bot that wait for the owner, oldest first.
export function pendingMemoryEdits(approvals: readonly Approval[], botId: string): Approval[] {
  return approvals.filter((approval) => approval.botId === botId && approval.memoryEdit !== null);
}

const NOTE_NAME = new RegExp(NOTE_NAME_PATTERN);

// Why a note name can't be saved, or undefined when it can. Names are plain file names ending in .md.
export function noteNameProblem(name: string): string | undefined {
  const { shortest, longest } = NoteNameLimits;
  if (name.length < shortest || name.length > longest) return `Use ${shortest} to ${longest} characters, ending in .md.`;
  if (!NOTE_NAME.test(name)) return "Start with a letter or digit, use letters, digits, spaces, dots, dashes, or underscores, and end in .md.";
  return undefined;
}

// A name for a new note that no existing note uses.
export function newNoteName(existing: readonly string[]): string {
  const taken = new Set(existing);
  for (let index = 1; ; index++) {
    const name = index === 1 ? "untitled.md" : `untitled-${index}.md`;
    if (!taken.has(name)) return name;
  }
}

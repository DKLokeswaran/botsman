import path from "node:path";
import { fileURLToPath } from "node:url";
import { isInside, resolveReal } from "../bots/folder-policy.ts";

export type BoundaryCheck =
  | { readonly leaves: false }
  | { readonly leaves: true; readonly reason: string; readonly description: string; readonly command: string };

// Tools that always stay inside the boundary: shell commands run in the sandbox, and the memory and notes tools reach
// only the bot's memory files and notes. Memory edits ask before this check.
const CONTAINED_TOOLS = new Set(["bash", "memory", "notes"]);
const FILE_TOOLS = new Set(["read", "write", "edit"]);

// Decides whether a tool call leaves the bot's folder. Commands are never judged: the sandbox limits what they reach.
// File tools leave when their path resolves outside the folder. Unknown tools count as leaving, so they ask.
export function checkBoundary(toolName: string, args: Record<string, unknown>, folder: string): BoundaryCheck {
  if (CONTAINED_TOOLS.has(toolName)) return { leaves: false };
  const command = JSON.stringify(args);
  if (!FILE_TOOLS.has(toolName)) {
    return { leaves: true, reason: `The ${toolName} tool acts outside the bot's folder`, description: `Run ${toolName}`, command };
  }
  const realFolder = resolveReal(folder);
  const targets = toolTargets(args.path, folder);
  const target = targets.find((candidate) => !isInside(candidate, realFolder));
  if (target === undefined) return { leaves: false };
  return {
    leaves: true,
    reason: `The path is outside the bot's folder (${folder})`,
    description: `${capitalize(toolName)} ${target}`,
    command,
  };
}

// Spaces Pi turns into plain spaces before using a path.
const UNICODE_SPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;

// Every real path a file tool might act on. Pi drops a leading `@`, expands `~` to the bot's folder (its home in the
// sandbox), turns `file://` URLs into paths, and `read` also tries other spellings of a missing file. Symlinks are
// followed to where they point.
function toolTargets(requested: unknown, folder: string): string[] {
  if (typeof requested !== "string") return [resolveReal(folder)];
  return [...new Set(spellings(resolveLikePi(requested, folder)))].map(resolveReal);
}

function resolveLikePi(requested: string, folder: string): string {
  const normalized = requested.replace(UNICODE_SPACES, " ");
  const withoutAt = normalized.startsWith("@") ? normalized.slice(1) : normalized;
  if (withoutAt === "~") return folder;
  if (withoutAt.startsWith("~/")) return path.join(folder, withoutAt.slice(2));
  return path.resolve(folder, fromFileUrl(withoutAt));
}

function fromFileUrl(candidate: string): string {
  if (!candidate.startsWith("file://")) return candidate;
  try {
    return fileURLToPath(candidate);
  } catch {
    return candidate;
  }
}

// The spellings `read` tries when a path doesn't exist.
function spellings(resolved: string): string[] {
  const nfd = resolved.normalize("NFD");
  return [resolved, resolved.replace(/ (AM|PM)\./gi, "\u202F$1."), nfd, resolved.replace(/'/g, "\u2019"), nfd.replace(/'/g, "\u2019")];
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

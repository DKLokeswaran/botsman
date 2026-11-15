import path from "node:path";
import { isInside } from "../bots/folder-policy.ts";

export type BoundaryCheck =
  | { readonly leaves: false }
  | { readonly leaves: true; readonly reason: string; readonly description: string; readonly command: string };

// Tools that always stay inside the boundary: shell commands run in the sandbox, and memory edits ask on their own.
const CONTAINED_TOOLS = new Set(["bash", "memory"]);
const FILE_TOOLS = new Set(["read", "write", "edit"]);

// Decides whether a tool call leaves the bot's folder. Commands are never judged: the sandbox limits what they reach.
// File tools leave when their path resolves outside the folder. Unknown tools count as leaving, so they ask.
export function checkBoundary(toolName: string, args: Record<string, unknown>, folder: string): BoundaryCheck {
  if (CONTAINED_TOOLS.has(toolName)) return { leaves: false };
  const command = JSON.stringify(args);
  if (!FILE_TOOLS.has(toolName)) {
    return { leaves: true, reason: `The ${toolName} tool acts outside the bot's folder`, description: `Run ${toolName}`, command };
  }
  const target = typeof args.path === "string" ? path.resolve(folder, args.path) : folder;
  if (isInside(target, folder)) return { leaves: false };
  return {
    leaves: true,
    reason: `The path is outside the bot's folder (${folder})`,
    description: `${capitalize(toolName)} ${target}`,
    command,
  };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

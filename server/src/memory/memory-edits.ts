import type { Bot, MemoryEdit, MemoryFileName } from "@botsman/protocol";
import { ApiError } from "../errors.ts";
import { assertWithinLimit, type MemoryFiles } from "./memory-files.ts";

export const MEMORY_TOOL = "memory";
export const EDIT_MEMORY = "edit_memory";
const DEFAULT_FILE: MemoryFileName = "BOT_MEMORY.md";

// Bot edits to memory files. Every edit goes through an approval; these checks run before the owner is asked and again before writing.
export class MemoryEdits {
  readonly #files: MemoryFiles;

  constructor(files: MemoryFiles) {
    this.#files = files;
  }

  // The edit a tool call asks for, or undefined when the call edits no memory file. Throws when the bot may not make it.
  describe(bot: Bot, toolName: string, args: Record<string, unknown>): MemoryEdit | undefined {
    if (toolName !== MEMORY_TOOL || args.action !== EDIT_MEMORY) return undefined;
    const file = (typeof args.file === "string" ? args.file : DEFAULT_FILE) as MemoryFileName;
    const content = typeof args.content === "string" ? args.content : "";
    assertMayWrite(bot, file);
    assertWithinLimit(file, content);
    return { file, content, previous: this.#files.read(bot.id, file) };
  }

  apply(bot: Bot, file: MemoryFileName, content: string): void {
    assertMayWrite(bot, file);
    this.#files.write(bot.id, file, content);
  }
}

// No bot writes a PROFILE file, and only the main bot writes USER_MEMORY.md.
function assertMayWrite(bot: Bot, file: MemoryFileName): void {
  if (file === "BOT_MEMORY.md") return;
  if (file === "USER_MEMORY.md" && bot.isMain) return;
  const message = file === "USER_MEMORY.md" ? "Only the main bot writes USER_MEMORY.md; message the main bot instead" : `No bot can write ${file}`;
  throw new ApiError(403, "forbidden", message);
}

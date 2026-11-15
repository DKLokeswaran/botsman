import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { MemoryFileNames, MemoryLimits, type MemoryFileName } from "@botsman/protocol";
import { ApiError } from "../errors.ts";

export type MemorySnapshot = Record<MemoryFileName, string>;

const SHARED_FILES: ReadonlySet<MemoryFileName> = new Set(["USER_PROFILE.md", "USER_MEMORY.md"]);

// The four memory files on disk: two shared by all bots in user/, two per bot in bots/<id>/.
export class MemoryFiles {
  readonly #userDir: string;
  readonly #botDir: (botId: string) => string;

  constructor(userDir: string, botDir: (botId: string) => string) {
    this.#userDir = userDir;
    this.#botDir = botDir;
    mkdirSync(userDir, { recursive: true });
  }

  read(botId: string, file: MemoryFileName): string {
    const target = this.#path(botId, file);
    return existsSync(target) ? readFileSync(target, "utf8") : "";
  }

  snapshot(botId: string): MemorySnapshot {
    return Object.fromEntries(MemoryFileNames.map((file) => [file, this.read(botId, file)])) as MemorySnapshot;
  }

  // Replaces a file's content, refusing anything over the file's limit.
  write(botId: string, file: MemoryFileName, content: string): void {
    assertWithinLimit(file, content);
    const target = this.#path(botId, file);
    mkdirSync(path.dirname(target), { recursive: true });
    const temporary = `${target}.tmp`;
    writeFileSync(temporary, content, { mode: 0o600 });
    renameSync(temporary, target);
  }

  #path(botId: string, file: MemoryFileName): string {
    return path.join(SHARED_FILES.has(file) ? this.#userDir : this.#botDir(botId), file);
  }
}

export function assertWithinLimit(file: MemoryFileName, content: string): void {
  const limit = MemoryLimits[file];
  if (content.length > limit) {
    throw new ApiError(400, "memory_limit", `${file} is limited to ${limit} characters; this content has ${content.length}`);
  }
}

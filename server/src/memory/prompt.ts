import { MemoryFileNames } from "@botsman/protocol";
import type { MemorySnapshot } from "./memory-files.ts";

const WRITERS: Record<string, string> = {
  "USER_PROFILE.md": "written by the owner, shared by all bots",
  "USER_MEMORY.md": "written by the main bot with the owner's confirmation, shared by all bots",
  "BOT_PROFILE.md": "your role and instructions, written by the owner",
  "BOT_MEMORY.md": "your own memory, which you edit through the memory tool with the owner's confirmation",
};

// The memory part of the system prompt. It stays frozen while the provider's cache is alive.
export function renderMemorySection(files: MemorySnapshot): string {
  return MemoryFileNames.map((file) => `## ${file} (${WRITERS[file]})\n${files[file].trim() || "(empty)"}`).join("\n\n");
}

// Text added to an incoming message for memory files that changed since the model last saw them.
export function memoryChangeText(seen: MemorySnapshot, current: MemorySnapshot): string {
  const changed = MemoryFileNames.filter((file) => seen[file] !== current[file]);
  if (changed.length === 0) return "";
  const parts = changed.map((file) => `${file} changed. Its full content is now:\n${current[file].trim() || "(empty)"}`);
  return `<memory-update>\n${parts.join("\n\n")}\n</memory-update>`;
}

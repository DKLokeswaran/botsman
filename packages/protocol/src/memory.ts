import { arr, int, obj, oneOf, type Static, str } from "@earendil-works/pi-schema";

export const MemoryFileNames = ["USER_PROFILE.md", "USER_MEMORY.md", "BOT_PROFILE.md", "BOT_MEMORY.md"] as const;
export const MemoryFileName = oneOf(MemoryFileNames);
export type MemoryFileName = Static<typeof MemoryFileName>;

// Character limits for each memory file.
export const MemoryLimits: Record<MemoryFileName, number> = {
  "USER_PROFILE.md": 4000,
  "USER_MEMORY.md": 2000,
  "BOT_PROFILE.md": 6000,
  "BOT_MEMORY.md": 4000,
};

export const MemoryFile = obj({
  name: MemoryFileName,
  content: str(),
  limit: int(),
  writtenBy: oneOf(["owner", "main_bot", "bot"]),
});
export type MemoryFile = Static<typeof MemoryFile>;

export const MemoryFiles = obj({ botId: str(), files: arr(MemoryFile) });
export type MemoryFiles = Static<typeof MemoryFiles>;

export const MemoryFileParams = obj({ id: str({ minLength: 1 }), file: MemoryFileName });
export type MemoryFileParams = Static<typeof MemoryFileParams>;

export const MemoryFileUpdate = obj({ content: str({ maxLength: 6000 }) });
export type MemoryFileUpdate = Static<typeof MemoryFileUpdate>;

// A bot's edit to a memory file, shown with the approval that asks the owner. `previous` is the file when the bot asked.
export const MemoryEdit = obj({ file: MemoryFileName, content: str(), previous: str() });
export type MemoryEdit = Static<typeof MemoryEdit>;

import type { Bot, MemoryFileName, ModelRef, NoteInfo, NoteSearchHit, ThinkingLevel } from "@botsman/protocol";
import type { Models } from "@earendil-works/pi-ai";
import type { ExecutionEnv } from "@earendil-works/pi-durable/env";
import type { ViewDocs, ViewEntry } from "../events/chat-view.ts";
import type { MemorySnapshot } from "../memory/memory-files.ts";
import type { ToolCheck, ToolVerdict } from "../permissions/permission-policy.ts";

// What the `memory` tool can do for one bot. The engine owns the tool; these services own the files.
export type MemoryToolBackend = {
  listNotes(botId: string): NoteInfo[];
  readNote(botId: string, name: string): string;
  writeNote(botId: string, name: string, content: string): void;
  deleteNote(botId: string, name: string): void;
  searchNotes(botId: string, query: string): NoteSearchHit[];
  readMemory(botId: string): MemorySnapshot;
  editMemory(bot: Bot, file: MemoryFileName, content: string): void;
};

// Everything the engine needs from the rest of the server, as plain interfaces.
export type EngineServices = {
  readonly models: Models;
  readonly sessionFile: (botId: string) => string;
  readonly currentBot: (botId: string) => Bot | undefined;
  readonly chatSettings: (bot: Bot) => { model: ModelRef | null; thinkingLevel: ThinkingLevel };
  readonly envFor: (bot: Bot) => ExecutionEnv;
  readonly stopSandbox: (botId: string) => void;
  readonly beforeTool: (check: ToolCheck) => Promise<ToolVerdict>;
  readonly memoryTool: MemoryToolBackend;
  readonly memorySnapshot: (botId: string) => MemorySnapshot;
  readonly onView: (botId: string, view: ChatView) => void;
  readonly log: (message: string) => void;
  readonly now?: () => number;
  // How long a provider keeps a prompt cache alive after the last request.
  readonly cacheLifetimeMs?: number;
};

export type ChatView = { readonly entries: readonly ViewEntry[]; readonly docs: ViewDocs };

export type SendMode = "send" | "steer" | "queue";
export type SendResult = { readonly submissionId: string; readonly placed: "started" | "steered" | "queued" };

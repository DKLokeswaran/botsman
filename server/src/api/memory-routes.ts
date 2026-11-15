import {
  IdParams,
  MemoryFileNames,
  MemoryFileParams,
  MemoryFileUpdate,
  MemoryLimits,
  type MemoryFile,
  type MemoryFileName,
  type MemoryFiles,
} from "@botsman/protocol";
import type { FastifyInstance } from "fastify";
import type { Services } from "../services.ts";

const WRITERS: Record<MemoryFileName, MemoryFile["writtenBy"]> = {
  "USER_PROFILE.md": "owner",
  "USER_MEMORY.md": "main_bot",
  "BOT_PROFILE.md": "owner",
  "BOT_MEMORY.md": "bot",
};

export function registerMemoryRoutes(app: FastifyInstance, services: Services): void {
  const { bots, memoryFiles } = services;

  // All four files as one bot sees them, with each file's limit.
  app.get<{ Params: IdParams }>("/api/bots/:id/memory", { schema: { params: IdParams } }, async (request): Promise<MemoryFiles> => {
    const bot = bots.get(request.params.id);
    const snapshot = memoryFiles.snapshot(bot.id);
    return { botId: bot.id, files: MemoryFileNames.map((name) => ({ name, content: snapshot[name], limit: MemoryLimits[name], writtenBy: WRITERS[name] })) };
  });

  // The owner edits any of the four files directly. Bots receive the change with their next incoming message.
  app.put<{ Params: MemoryFileParams; Body: MemoryFileUpdate }>("/api/bots/:id/memory/:file", { schema: { params: MemoryFileParams, body: MemoryFileUpdate } }, async (request): Promise<MemoryFile> => {
    const bot = bots.get(request.params.id);
    const file = request.params.file;
    memoryFiles.write(bot.id, file, request.body.content);
    return { name: file, content: memoryFiles.read(bot.id, file), limit: MemoryLimits[file], writtenBy: WRITERS[file] };
  });

}

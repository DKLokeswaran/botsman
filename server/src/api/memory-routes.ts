import {
  IdParams,
  MemoryFileNames,
  MemoryFileParams,
  MemoryFileUpdate,
  MemoryLimits,
  type MemoryFile,
  type MemoryFileName,
  type MemoryFiles,
  type MemoryProposal,
  type MemoryProposalList,
  ProposalAnswer,
  ProposalListQuery,
} from "@botsman/protocol";
import type { FastifyInstance } from "fastify";
import { notFound } from "../errors.ts";
import type { Services } from "../services.ts";

const WRITERS: Record<MemoryFileName, MemoryFile["writtenBy"]> = {
  "USER_PROFILE.md": "owner",
  "USER_MEMORY.md": "main_bot",
  "BOT_PROFILE.md": "owner",
  "BOT_MEMORY.md": "bot",
};

export function registerMemoryRoutes(app: FastifyInstance, services: Services): void {
  const { bots, memoryFiles, proposals } = services;
  const liveBotIds = () => bots.list().map((bot) => bot.id);

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

  app.get<{ Querystring: ProposalListQuery }>("/api/memory/proposals", { schema: { querystring: ProposalListQuery } }, async (request): Promise<MemoryProposalList> => {
    const botIds = request.query.botId === undefined ? liveBotIds() : liveBotIds().filter((id) => id === request.query.botId);
    return { proposals: proposals.list({ status: request.query.status, botIds }) };
  });

  app.post<{ Params: IdParams; Body: ProposalAnswer }>("/api/memory/proposals/:id/answer", { schema: { params: IdParams, body: ProposalAnswer } }, async (request): Promise<MemoryProposal> => {
    const proposal = proposals.get(request.params.id);
    if (!liveBotIds().includes(proposal.botId)) throw notFound("Proposal");
    return proposals.answer(proposal.id, request.body.decision);
  });
}

import { type Bot, BotCreate, type BotList, BotUpdate, type FreeSpace, FreeSpaceQuery, IdParams, MarkRead, type Ok } from "@botsman/protocol";
import type { FastifyInstance } from "fastify";
import type { Services } from "../services.ts";

export function registerBotRoutes(app: FastifyInstance, services: Services): void {
  const { bots } = services;

  app.get("/api/bots", async (): Promise<BotList> => ({ bots: bots.list() }));

  app.post<{ Body: BotCreate }>("/api/bots", { schema: { body: BotCreate } }, async (request, reply): Promise<Bot> => {
    reply.status(201);
    return bots.create(request.body);
  });

  app.get<{ Params: IdParams }>("/api/bots/:id", { schema: { params: IdParams } }, async (request): Promise<Bot> => bots.get(request.params.id));

  app.patch<{ Params: IdParams; Body: BotUpdate }>("/api/bots/:id", { schema: { params: IdParams, body: BotUpdate } }, async (request): Promise<Bot> =>
    bots.update(request.params.id, request.body),
  );

  // Marks the bot deleted. Its files stay on disk, and only the main bot can restore it.
  app.delete<{ Params: IdParams }>("/api/bots/:id", { schema: { params: IdParams } }, async (request): Promise<Ok> => {
    await bots.delete(request.params.id);
    return { ok: true };
  });

  // Marks the bot's chat read up to a message time, for every device.
  app.post<{ Params: IdParams; Body: MarkRead }>("/api/bots/:id/read", { schema: { params: IdParams, body: MarkRead } }, async (request): Promise<Ok> => {
    bots.get(request.params.id);
    services.activity.markRead(request.params.id, request.body.upTo);
    return { ok: true };
  });

  app.get<{ Querystring: FreeSpaceQuery }>("/api/server/free-space", { schema: { querystring: FreeSpaceQuery } }, async (request): Promise<FreeSpace> =>
    bots.freeSpace(request.query.path),
  );
}

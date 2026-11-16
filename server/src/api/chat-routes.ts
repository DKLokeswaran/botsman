import {
  type Bot,
  type ChatHistoryPage,
  type ChatSettings,
  ChatSettingsUpdate,
  type ChatSnapshot,
  IdParams,
  type Ok,
  PageQuery,
  SendMessageRequest,
  type SendMessageResponse,
} from "@botsman/protocol";
import type { FastifyInstance } from "fastify";
import { ApiError, badRequest } from "../errors.ts";
import { chatSnapshot } from "./chat-snapshot.ts";
import { toChatMessage } from "../events/chat-view.ts";
import type { Services } from "../services.ts";

export function registerChatRoutes(app: FastifyInstance, services: Services): void {
  const { bots, engine, feed, registry } = services;
  const opts = { schema: { params: IdParams } };

  app.get<{ Params: IdParams }>("/api/bots/:id/chat", opts, async (request): Promise<ChatSnapshot> => {
    const bot = runnableBot(services, request.params.id);
    await engine.view(bot);
    return chatSnapshot(services, bot);
  });

  app.get<{ Params: IdParams; Querystring: PageQuery }>("/api/bots/:id/chat/history", { schema: { params: IdParams, querystring: PageQuery } }, async (request): Promise<ChatHistoryPage> => {
    const bot = runnableBot(services, request.params.id);
    const before = request.query.before === undefined ? undefined : Number(request.query.before);
    if (before !== undefined && !Number.isInteger(before)) throw badRequest("before must be a message id");
    const page = await engine.history(bot, before, request.query.limit ?? 50);
    return { messages: page.entries.flatMap((entry) => toChatMessage(entry) ?? []), hasEarlier: page.hasEarlier };
  });

  app.post<{ Params: IdParams; Body: SendMessageRequest }>("/api/bots/:id/chat/messages", { schema: { params: IdParams, body: SendMessageRequest } }, async (request): Promise<SendMessageResponse> => {
    const bot = runnableBot(services, request.params.id);
    await assertModelConnected(services, bot);
    return engine.send(bot, request.body.text, request.body.mode ?? "send", request.body.requestId);
  });

  // Stops the reply, withdraws queued messages, and ends every process the bot started.
  app.post<{ Params: IdParams }>("/api/bots/:id/chat/stop", opts, async (request): Promise<Ok> => {
    await engine.stop(runnableBot(services, request.params.id));
    return { ok: true };
  });

  app.patch<{ Params: IdParams; Body: ChatSettingsUpdate }>("/api/bots/:id/chat/settings", { schema: { params: IdParams, body: ChatSettingsUpdate } }, async (request): Promise<ChatSettings> => {
    const bot = runnableBot(services, request.params.id);
    const model = request.body.model;
    if (model && !services.catalog.hasModel(model.provider, model.modelId)) throw badRequest(`Unknown model ${model.provider}/${model.modelId}`);
    registry.setChatSettings(bot.id, model, request.body.thinkingLevel);
    await engine.configure(bots.get(bot.id));
    const settings = registry.chatSettings(bot);
    feed.settingsChanged(bot.id, settings);
    return settings;
  });
}

// Bots never run unsandboxed: chat is refused while sandboxes don't work.
function runnableBot(services: Services, id: string): Bot {
  const bot = services.bots.get(id);
  if (!services.sandbox.status.ok) throw new ApiError(503, "sandbox_unavailable", "Bots can't run because sandboxes don't work on this server", services.sandbox.status.reason ?? undefined);
  return bot;
}

async function assertModelConnected(services: Services, bot: Bot): Promise<void> {
  const model = services.registry.chatSettings(bot).model;
  if (model === null) throw new ApiError(409, "model_not_connected", "Choose a model for this bot first");
  if (!services.catalog.hasModel(model.provider, model.modelId) || !(await services.catalog.isConnected(model.provider))) {
    throw new ApiError(409, "model_not_connected", `Connect ${model.provider} to use ${model.modelId}`);
  }
}

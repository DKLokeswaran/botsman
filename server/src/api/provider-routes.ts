import { ApiKeyRequest, IdParams, LoginAnswer, LoginParams, type ModelList, type Ok, type ProviderList, type ProviderLogin } from "@botsman/protocol";
import type { FastifyInstance } from "fastify";
import type { Services } from "../services.ts";

// Keys and sign-ins are stored only on the server; nothing here ever returns a secret.
export function registerProviderRoutes(app: FastifyInstance, services: Services): void {
  const { catalog, logins } = services;

  app.get("/api/providers", async (): Promise<ProviderList> => ({ providers: await catalog.list() }));

  app.get("/api/models", async (): Promise<ModelList> => ({ models: await catalog.connectedModels() }));

  app.put<{ Params: IdParams; Body: ApiKeyRequest }>("/api/providers/:id/key", { schema: { params: IdParams, body: ApiKeyRequest } }, async (request): Promise<Ok> => {
    await catalog.saveApiKey(request.params.id, request.body.key.trim());
    return { ok: true };
  });

  app.delete<{ Params: IdParams }>("/api/providers/:id", { schema: { params: IdParams } }, async (request): Promise<Ok> => {
    await catalog.disconnect(request.params.id);
    return { ok: true };
  });

  app.post<{ Params: IdParams }>("/api/providers/:id/login", { schema: { params: IdParams } }, async (request): Promise<ProviderLogin> => logins.start(request.params.id));

  app.get<{ Params: LoginParams }>("/api/provider-logins/:loginId", { schema: { params: LoginParams } }, async (request): Promise<ProviderLogin> => logins.get(request.params.loginId));

  app.post<{ Params: LoginParams; Body: LoginAnswer }>("/api/provider-logins/:loginId/answer", { schema: { params: LoginParams, body: LoginAnswer } }, async (request): Promise<ProviderLogin> =>
    logins.answer(request.params.loginId, request.body.promptId, request.body.value),
  );

  app.post<{ Params: LoginParams }>("/api/provider-logins/:loginId/cancel", { schema: { params: LoginParams } }, async (request): Promise<ProviderLogin> => logins.cancel(request.params.loginId));
}

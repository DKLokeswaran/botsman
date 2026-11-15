import { IdParams, LoginRequest, RefreshRequest, SetupRequest, type DeviceSessionList, type Ok, type SetupStatus, type Tokens } from "@botsman/protocol";
import type { FastifyInstance } from "fastify";
import { RateLimiter } from "../auth/rate-limit.ts";
import { ApiError } from "../errors.ts";
import type { Services } from "../services.ts";

const PUBLIC = { public: true };

export function registerAuthRoutes(app: FastifyInstance, services: Services): void {
  const { auth, bots } = services;
  // Ten password attempts per address and thirty in all every fifteen minutes. The overall cap holds even when a
  // local process fakes X-Forwarded-For to look like many addresses.
  const perAddress = new RateLimiter(10, 15 * 60_000);
  const overall = new RateLimiter(30, 15 * 60_000);
  const limit = (ip: string) => {
    const allowed = perAddress.take(ip) && overall.take("all");
    if (!allowed) throw new ApiError(429, "rate_limited", "Too many sign-in attempts; wait and try again");
  };

  app.get("/api/setup", { config: PUBLIC }, async (): Promise<SetupStatus> => ({ needsSetup: !auth.hasOwner() }));

  // First-run setup: sets the password, creates the main bot, and signs this device in.
  app.post<{ Body: SetupRequest }>("/api/setup", { config: PUBLIC, schema: { body: SetupRequest } }, async (request): Promise<Tokens> => {
    limit(request.ip);
    if (auth.hasOwner()) throw new ApiError(409, "already_set_up", "The server is already set up");
    // A setup that failed after creating the main bot keeps that bot.
    if (services.registry.mainBot() === undefined) await bots.create(request.body.mainBot, true);
    await auth.createOwner(request.body.password);
    return auth.startSession(request.body.deviceName);
  });

  app.post<{ Body: LoginRequest }>("/api/auth/login", { config: PUBLIC, schema: { body: LoginRequest } }, async (request): Promise<Tokens> => {
    limit(request.ip);
    return auth.login(request.body.password, request.body.deviceName);
  });

  app.post<{ Body: RefreshRequest }>("/api/auth/refresh", { config: PUBLIC, schema: { body: RefreshRequest } }, async (request): Promise<Tokens> => auth.refresh(request.body.refreshToken));

  app.post("/api/auth/logout", async (request): Promise<Ok> => {
    auth.revoke(request.sessionId!);
    return { ok: true };
  });

  app.get("/api/auth/sessions", async (request): Promise<DeviceSessionList> => ({ sessions: auth.listSessions(request.sessionId) }));

  app.delete<{ Params: IdParams }>("/api/auth/sessions/:id", { schema: { params: IdParams } }, async (request): Promise<Ok> => {
    auth.revoke(request.params.id);
    return { ok: true };
  });
}

import { IdParams, LoginRequest, RefreshRequest, SetupRequest, type DeviceSessionList, type Ok, type SessionInfo, type SetupStatus, type Tokens } from "@botsman/protocol";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { REFRESH_COOKIE, clearedCookies, readCookie, sameOrigin, sessionCookies, sessionInfo } from "../auth/cookies.ts";
import { RateLimiter } from "../auth/rate-limit.ts";
import { ApiError } from "../errors.ts";
import type { Services } from "../services.ts";

const PUBLIC = { public: true };

export function registerAuthRoutes(app: FastifyInstance, services: Services): void {
  const { auth, bots } = services;
  // Wrong passwords: ten per address and thirty in all every fifteen minutes. The overall cap holds when a local
  // process fakes X-Forwarded-For. Setup has its own ten attempts per address.
  const perAddress = new RateLimiter(10, 15 * 60_000);
  const overall = new RateLimiter(30, 15 * 60_000);
  const setups = new RateLimiter(10, 15 * 60_000);
  const refuse = () => new ApiError(429, "rate_limited", "Too many sign-in attempts; wait and try again");

  // A sign-in is counted before the password is checked, so parallel guesses can't all slip under the caps.
  // Anything but a wrong password gives the count back, so the owner's own sign-ins never use the budget.
  const signIn = async (ip: string, attempt: () => Promise<Tokens>): Promise<Tokens> => {
    if (!overall.allows("all") || !perAddress.allows(ip)) throw refuse();
    perAddress.record(ip);
    overall.record("all");
    try {
      const tokens = await attempt();
      forgive(ip);
      return tokens;
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) forgive(ip);
      throw error;
    }
  };
  const forgive = (ip: string) => {
    perAddress.forgive(ip);
    overall.forgive("all");
  };

  app.get("/api/setup", { config: PUBLIC }, async (): Promise<SetupStatus> => ({ needsSetup: !auth.hasOwner() }));

  // First-run setup: sets the password, creates the main bot, and signs this device in.
  app.post<{ Body: SetupRequest }>("/api/setup", { config: PUBLIC, schema: { body: SetupRequest } }, async (request, reply): Promise<Tokens | SessionInfo> => {
    if (request.body.cookie) requireOwnPage(request);
    if (!setups.allows(request.ip)) throw refuse();
    setups.record(request.ip);
    if (auth.hasOwner()) throw new ApiError(409, "already_set_up", "The server is already set up");
    // A setup that failed after creating the main bot keeps that bot.
    if (services.registry.mainBot() === undefined) await bots.create(request.body.mainBot, true);
    await auth.createOwner(request.body.password);
    return signedIn(reply, auth.startSession(request.body.deviceName), request.body.cookie === true);
  });

  app.post<{ Body: LoginRequest }>("/api/auth/login", { config: PUBLIC, schema: { body: LoginRequest } }, async (request, reply): Promise<Tokens | SessionInfo> => {
    if (request.body.cookie) requireOwnPage(request);
    const tokens = await signIn(request.ip, () => auth.login(request.body.password, request.body.deviceName));
    return signedIn(reply, tokens, request.body.cookie === true);
  });

  // An app sends its refresh token in the body. The dashboard sends none, and the server reads its cookie.
  app.post<{ Body: RefreshRequest | undefined }>("/api/auth/refresh", { config: PUBLIC, schema: { body: RefreshRequest } }, async (request, reply): Promise<Tokens | SessionInfo> => {
    const fromBody = request.body?.refreshToken;
    if (fromBody !== undefined) return auth.refresh(fromBody);
    requireOwnPage(request);
    const fromCookie = readCookie(request.headers.cookie, REFRESH_COOKIE);
    if (fromCookie === undefined) throw new ApiError(401, "unauthorized", "Sign in first");
    return signedIn(reply, auth.refresh(fromCookie), true);
  });

  app.post("/api/auth/logout", async (request, reply): Promise<Ok> => {
    auth.revoke(request.sessionId!);
    reply.header("set-cookie", clearedCookies());
    return { ok: true };
  });

  app.get("/api/auth/sessions", async (request): Promise<DeviceSessionList> => ({ sessions: auth.listSessions(request.sessionId) }));

  app.delete<{ Params: IdParams }>("/api/auth/sessions/:id", { schema: { params: IdParams } }, async (request): Promise<Ok> => {
    auth.revoke(request.params.id);
    return { ok: true };
  });
}

// Sends the new session: as cookies for the dashboard, or as tokens for an app.
function signedIn(reply: FastifyReply, tokens: Tokens, asCookies: boolean): Tokens | SessionInfo {
  if (!asCookies) return tokens;
  reply.header("set-cookie", sessionCookies(tokens, Date.now()));
  return sessionInfo(tokens);
}

// Cookie sessions are only started or renewed from the dashboard's own pages.
function requireOwnPage(request: FastifyRequest): void {
  if (!sameOrigin(request.headers.origin, request.host)) throw new ApiError(403, "forbidden", "This request must come from the dashboard");
}

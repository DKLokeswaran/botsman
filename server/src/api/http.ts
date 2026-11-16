import { readFileSync } from "node:fs";
import type { ErrorBody } from "@botsman/protocol";
import { compile } from "@earendil-works/pi-schema";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { ACCESS_COOKIE, readCookie, sameOrigin } from "../auth/cookies.ts";
import { ApiError } from "../errors.ts";
import type { Services } from "../services.ts";
import { registerAlertsSocket } from "./alerts-socket.ts";
import { registerApprovalRoutes } from "./approval-routes.ts";
import { registerAuthRoutes } from "./auth-routes.ts";
import { registerBotRoutes } from "./bot-routes.ts";
import { registerChatRoutes } from "./chat-routes.ts";
import { registerDashboardRoutes } from "./dashboard-routes.ts";
import { registerMemoryRoutes } from "./memory-routes.ts";
import { registerNoteRoutes } from "./note-routes.ts";
import { registerProviderRoutes } from "./provider-routes.ts";
import { registerSocket } from "./socket.ts";
import { registerSystemRoutes } from "./system-routes.ts";

declare module "fastify" {
  interface FastifyRequest {
    sessionId?: string;
  }
  interface FastifyContextConfig {
    public?: boolean;
  }
}

// The largest WebSocket message a client may send.
const MAX_SOCKET_MESSAGE_BYTES = 64 * 1024;

// The Fastify app: HTTPS only, JSON Schema validation through pi-schema, and bearer-token auth on every private route.
export async function buildHttp(services: Services): Promise<FastifyInstance> {
  const { config } = services;
  const https = config.tls === undefined ? undefined : { cert: readFileSync(config.tls.certFile), key: readFileSync(config.tls.keyFile) };
  const app = Fastify({ trustProxy: [...config.trustProxy], bodyLimit: 2 * 1024 * 1024, ...(https ? { https } : {}) }) as unknown as FastifyInstance;

  app.setValidatorCompiler(({ schema }) => {
    const validator = compile(schema as object, { coerce: true });
    return (data: unknown) => {
      const result = validator.parse(data);
      return result.ok ? { value: result.value } : { error: new Error(result.errors.map((error) => `${error.path || "/"} ${error.message}`).join("; ")) };
    };
  });
  app.setErrorHandler((error, _request, reply) => sendError(reply, error));
  app.addHook("onRequest", requireHttps);
  app.addHook("onRequest", async (request) => authenticate(services, request));

  // Client messages are small; a large frame is refused before it is parsed.
  await app.register(websocket, { options: { maxPayload: MAX_SOCKET_MESSAGE_BYTES } });
  registerSystemRoutes(app, services);
  registerDashboardRoutes(app, services);
  registerAuthRoutes(app, services);
  registerBotRoutes(app, services);
  registerChatRoutes(app, services);
  registerApprovalRoutes(app, services);
  registerMemoryRoutes(app, services);
  registerNoteRoutes(app, services);
  registerProviderRoutes(app, services);
  registerSocket(app, services);
  registerAlertsSocket(app, services);
  return app;
}

// Plain HTTP is refused. Behind Tailscale Serve or Caddy the proxy's X-Forwarded-Proto says whether TLS was used.
async function requireHttps(request: FastifyRequest): Promise<void> {
  if (request.protocol !== "https") throw new ApiError(403, "https_required", "This server only accepts HTTPS");
}

async function authenticate(services: Services, request: FastifyRequest): Promise<void> {
  if (request.routeOptions.config?.public) return;
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    request.sessionId = services.auth.verifyAccess(header.slice(7));
    return;
  }
  request.sessionId = services.auth.verifyAccess(cookieToken(request));
}

// The dashboard's access token. A browser attaches cookies to requests other sites start, so a request that
// changes anything must also come from the dashboard's own pages.
function cookieToken(request: FastifyRequest): string {
  const token = readCookie(request.headers.cookie, ACCESS_COOKIE);
  if (token === undefined) throw new ApiError(401, "unauthorized", "Sign in first");
  const reads = request.method === "GET" || request.method === "HEAD";
  if (!reads && !sameOrigin(request.headers.origin, request.host)) throw new ApiError(403, "forbidden", "This request must come from the dashboard");
  return token;
}

function sendError(reply: FastifyReply, error: unknown): FastifyReply {
  const body = errorBody(error);
  const status = statusOf(error);
  if (status === 500) reply.log.error(error);
  return reply.status(status).send(body);
}

function statusOf(error: unknown): number {
  if (error instanceof ApiError) return error.status;
  if (isValidation(error)) return 400;
  return isFastifyClientError(error) ? (error as { statusCode: number }).statusCode : 500;
}

function errorBody(error: unknown): ErrorBody {
  if (error instanceof ApiError) return { error: error.code, message: error.message, ...(error.detail ? { detail: error.detail } : {}) };
  if (isValidation(error)) return { error: "bad_request", message: (error as Error).message };
  if (isFastifyClientError(error)) return { error: "bad_request", message: (error as Error).message };
  return { error: "internal", message: "Something went wrong on the server" };
}

function isValidation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "validation" in error;
}

function isFastifyClientError(error: unknown): boolean {
  const status = (error as { statusCode?: number } | undefined)?.statusCode;
  return typeof status === "number" && status >= 400 && status < 500;
}

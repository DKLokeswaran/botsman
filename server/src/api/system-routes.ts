import { type Health, OLDEST_ACCEPTED_PROTOCOL, PROTOCOL_VERSION, type ProtocolRange } from "@botsman/protocol";
import type { FastifyInstance } from "fastify";
import type { Services } from "../services.ts";

const VERSION = "0.1.0";
const PROTOCOL: ProtocolRange = { oldest: OLDEST_ACCEPTED_PROTOCOL, current: PROTOCOL_VERSION };

export function registerSystemRoutes(app: FastifyInstance, services: Services): void {
  app.get("/api/health", { config: { public: true } }, async (): Promise<Health> => ({ ok: services.sandbox.status.ok, version: VERSION, protocol: PROTOCOL, sandbox: services.sandbox.status }));
}

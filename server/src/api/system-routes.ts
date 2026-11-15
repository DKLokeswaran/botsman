import type { ComingSoon, Health } from "@botsman/protocol";
import type { FastifyInstance } from "fastify";
import type { Services } from "../services.ts";

const VERSION = "0.1.0";
const COMING_SOON: ComingSoon = { status: "coming_soon", feature: "web-dashboard" };

export function registerSystemRoutes(app: FastifyInstance, services: Services): void {
  app.get("/api/health", { config: { public: true } }, async (): Promise<Health> => ({ ok: services.sandbox.status.ok, version: VERSION, sandbox: services.sandbox.status }));

  // The web dashboard comes later; its paths answer with a fixed reply until then.
  for (const url of ["/", "/app", "/app/*"]) app.get(url, { config: { public: true } }, async () => COMING_SOON);
}

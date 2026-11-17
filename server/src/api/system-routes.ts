import { type AlertSettings, AlertSettingsUpdate, type Health, OLDEST_ACCEPTED_PROTOCOL, PROTOCOL_VERSION, type ProtocolRange, UsageQuery, type UsageReport } from "@botsman/protocol";
import type { FastifyInstance } from "fastify";
import type { Services } from "../services.ts";

const VERSION = "0.1.0";
const PROTOCOL: ProtocolRange = { oldest: OLDEST_ACCEPTED_PROTOCOL, current: PROTOCOL_VERSION };

export function registerSystemRoutes(app: FastifyInstance, services: Services): void {
  app.get("/api/health", { config: { public: true } }, async (): Promise<Health> => ({ ok: services.sandbox.status.ok, version: VERSION, protocol: PROTOCOL, sandbox: services.sandbox.status }));

  // Spending by day and by bot, for the usage screen.
  app.get<{ Querystring: UsageQuery }>("/api/usage", { schema: { querystring: UsageQuery } }, async (request): Promise<UsageReport> =>
    services.usage.report(request.query.days ?? 30, request.query.tzOffset ?? 0),
  );

  app.get("/api/settings/alerts", async (): Promise<AlertSettings> => services.alertSettings.get());

  // Changes which alert kinds reach the alerts stream, and tells every open app.
  app.patch<{ Body: AlertSettingsUpdate }>("/api/settings/alerts", { schema: { body: AlertSettingsUpdate } }, async (request): Promise<AlertSettings> => {
    const settings = services.alertSettings.update(request.body);
    services.publish({ type: "alert_settings", settings });
    return settings;
  });
}

import { type AlertSettings, AlertSettingsUpdate, type Health, OLDEST_ACCEPTED_PROTOCOL, PROTOCOL_VERSION, type ProtocolRange, UsageQuery, type UsageReport } from "@botsman/protocol";
import type { FastifyInstance } from "fastify";
import { SERVER_VERSION } from "../release/server-version.ts";
import type { Services } from "../services.ts";

const PROTOCOL: ProtocolRange = { oldest: OLDEST_ACCEPTED_PROTOCOL, current: PROTOCOL_VERSION };

// The server's state, version, and protocol range. Fields the server doesn't know are left out.
function health(services: Services): Health {
  const { commit, branch, preview } = services.config;
  const latestVersion = services.latestRelease.version;
  return {
    ok: services.sandbox.status.ok,
    version: SERVER_VERSION,
    ...(commit === undefined ? {} : { commit }),
    ...(branch === undefined ? {} : { branch }),
    preview,
    ...(latestVersion === undefined ? {} : { latestVersion }),
    protocol: PROTOCOL,
    sandbox: services.sandbox.status,
  };
}

export function registerSystemRoutes(app: FastifyInstance, services: Services): void {
  app.get("/api/health", { config: { public: true } }, async (): Promise<Health> => health(services));

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

import type { FastifyInstance } from "fastify";
import { buildHttp, CLIENT_CLOSE_WAIT_MS } from "./api/http.ts";
import { scheduleNightlyBackup } from "./backup/nightly.ts";
import type { Config } from "./config.ts";
import { createServices, type ServiceOptions, type Services } from "./services.ts";
import { scriptModelProvider } from "./testing/script-model.ts";

export type Botsman = { readonly services: Services; readonly http: FastifyInstance; stop(): Promise<void> };

// Starts every service and the HTTP server, and resumes bots a crash or restart interrupted.
export async function startBotsman(config: Config, options: ServiceOptions & { backups?: boolean } = {}): Promise<Botsman> {
  const log = options.log ?? ((message: string) => console.log(message));
  const extraProviders = config.scriptModel ? [{ provider: scriptModelProvider().provider, methods: ["api_key"] as const }] : [];
  const services = await createServices(config, { ...options, log, extraProviders: [...extraProviders, ...(options.extraProviders ?? [])] });
  const http = await buildHttp(services);
  await http.listen({ host: config.host, port: config.port });
  await services.resumeBots();
  const cancelBackups = options.backups === false ? () => {} : scheduleNightlyBackup(services, log);
  return {
    services,
    http,
    async stop() {
      cancelBackups();
      await closeHttp(http);
      await services.close();
    },
  };
}

// Lets open requests finish, then drops every connection still open, so no client can hold up a stop.
async function closeHttp(http: FastifyInstance): Promise<void> {
  const dropRest = setTimeout(() => http.server.closeAllConnections(), CLIENT_CLOSE_WAIT_MS);
  await http.close().finally(() => clearTimeout(dropRest));
}

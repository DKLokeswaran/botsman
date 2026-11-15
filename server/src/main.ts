import { loadConfig } from "./config.ts";
import { startBotsman } from "./server.ts";

const config = loadConfig();
const botsman = await startBotsman(config);
console.log(`Botsman listening on ${config.host}:${config.port}, data in ${config.dataDir}`);
if (!botsman.services.sandbox.status.ok) console.log(`Bots will not run: ${botsman.services.sandbox.status.reason}`);

// systemd stops the service with SIGTERM; close storage cleanly so nothing waits for crash recovery.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    void botsman.stop().finally(() => process.exit(0));
  });
}

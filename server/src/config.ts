import { homedir } from "node:os";
import path from "node:path";

export type Config = {
  readonly dataDir: string;
  readonly homeDir: string;
  readonly host: string;
  readonly port: number;
  readonly trustProxy: readonly string[];
  readonly tls?: { readonly certFile: string; readonly keyFile: string };
  readonly backupDir: string;
  readonly backupHour: number;
  readonly backupKeep: number;
  readonly scriptModel: boolean;
};

// Paths inside the data folder, as laid out in docs/decisions/overview.md.
export function dataPaths(dataDir: string) {
  return {
    serverDb: path.join(dataDir, "server.db"),
    secretKey: path.join(dataDir, "secret.key"),
    userDir: path.join(dataDir, "user"),
    skillsDir: path.join(dataDir, "skills"),
    botsDir: path.join(dataDir, "bots"),
    workspacesDir: path.join(dataDir, "workspaces"),
    botDir: (botId: string) => path.join(dataDir, "bots", botId),
    defaultWorkspace: (botId: string) => path.join(dataDir, "workspaces", botId),
  };
}

// Reads settings from environment variables, with the documented defaults.
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const home = homedir();
  const dataDir = path.resolve(env.BOTSMAN_DATA_DIR ?? path.join(home, ".botsman"));
  return {
    dataDir,
    homeDir: home,
    host: env.BOTSMAN_HOST ?? "127.0.0.1",
    port: Number(env.BOTSMAN_PORT ?? 7600),
    trustProxy: (env.BOTSMAN_TRUST_PROXY ?? "127.0.0.1,::1").split(",").map((entry) => entry.trim()).filter(Boolean),
    tls: tlsFromEnv(env),
    backupDir: path.resolve(env.BOTSMAN_BACKUP_DIR ?? path.join(home, ".botsman-backups")),
    backupHour: Number(env.BOTSMAN_BACKUP_HOUR ?? 3),
    backupKeep: Number(env.BOTSMAN_BACKUP_KEEP ?? 7),
    scriptModel: env.BOTSMAN_SCRIPT_MODEL === "1",
  };
}

function tlsFromEnv(env: NodeJS.ProcessEnv): Config["tls"] {
  if (!env.BOTSMAN_TLS_CERT || !env.BOTSMAN_TLS_KEY) return undefined;
  return { certFile: env.BOTSMAN_TLS_CERT, keyFile: env.BOTSMAN_TLS_KEY };
}

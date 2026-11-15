import type { Services } from "../services.ts";
import { pruneBackups, writeBackup } from "./backup.ts";

// Runs one backup and keeps the newest few.
export async function runBackup(services: Services): Promise<string> {
  const { config } = services;
  const target = await writeBackup(
    { dataDir: config.dataDir, serverDb: services.db, botFolders: services.registry.allFolders() },
    config.backupDir,
  );
  pruneBackups(config.backupDir, config.backupKeep);
  return target;
}

// Schedules a backup every night at the configured hour, local time.
export function scheduleNightlyBackup(services: Services, log: (message: string) => void): () => void {
  let timer: NodeJS.Timeout;
  const arm = () => {
    timer = setTimeout(async () => {
      await runBackup(services).then((target) => log(`backup written to ${target}`), (error) => log(`backup failed: ${String(error)}`));
      arm();
    }, msUntilHour(services.config.backupHour, new Date()));
  };
  arm();
  return () => clearTimeout(timer);
}

export function msUntilHour(hour: number, now: Date): number {
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { backup as sqliteBackup, DatabaseSync } from "node:sqlite";
import type { Database } from "../store/database.ts";

export type BackupSources = {
  readonly dataDir: string;
  readonly serverDb: Database;
  // Every bot's folder, deleted bots included.
  readonly botFolders: readonly { botId: string; folder: string }[];
};

// Files in the data folder that are never copied. The secret key stays out so a stolen backup can't decrypt keys.
const SKIPPED = new Set(["secret.key", "server.db", "server.db-wal", "server.db-shm"]);

// Writes one dated backup: SQLite files through SQLite's online backup, everything else copied as files.
// The backup is built in a temporary folder and renamed into place only once complete.
export async function writeBackup(sources: BackupSources, backupDir: string, now = new Date()): Promise<string> {
  const name = now.toISOString().replace(/[:.]/g, "-");
  const target = path.join(backupDir, name);
  const partial = `${target}.partial`;
  mkdirSync(path.join(partial, "data"), { recursive: true, mode: 0o700 });
  try {
    await sqliteBackup(sources.serverDb, path.join(partial, "data", "server.db"));
    await copyDataFolder(sources.dataDir, path.join(partial, "data"));
    for (const { botId, folder } of sources.botFolders) {
      if (!isInsideFolder(folder, sources.dataDir) && existsSync(folder)) cpSync(folder, path.join(partial, "folders", botId), { recursive: true, verbatimSymlinks: true });
    }
    renameSync(partial, target);
    return target;
  } catch (error) {
    rmSync(partial, { recursive: true, force: true });
    throw error;
  }
}

// Removes all but the newest `keep` backups.
export function pruneBackups(backupDir: string, keep: number): void {
  if (!existsSync(backupDir)) return;
  const complete = readdirSync(backupDir).filter((name) => !name.endsWith(".partial")).sort();
  for (const name of complete.slice(0, Math.max(0, complete.length - keep))) rmSync(path.join(backupDir, name), { recursive: true, force: true });
}

async function copyDataFolder(source: string, target: string): Promise<void> {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (SKIPPED.has(entry.name)) continue;
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) await copyDataFolder(from, to);
    else if (entry.name.endsWith(".sqlite")) await backupSqliteFile(from, to);
    else if (!/\.sqlite-(wal|shm)$/.test(entry.name)) cpSync(from, to, { verbatimSymlinks: true });
  }
}

// A bot's Pi storage is open in the server, so it is copied through SQLite rather than as raw bytes.
async function backupSqliteFile(from: string, to: string): Promise<void> {
  const db = new DatabaseSync(from, { readOnly: true });
  try {
    await sqliteBackup(db, to);
  } finally {
    db.close();
  }
}

function isInsideFolder(inner: string, outer: string): boolean {
  const relative = path.relative(outer, inner);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

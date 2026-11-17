import type { LocalCache } from "@botsman/client-core";
import { openDatabaseAsync } from "expo-sqlite";

// The local cache in an SQLite file in the app's private storage.
const opened = openDatabaseAsync("botsman-cache.db").then(async (db) => {
  await db.execAsync("CREATE TABLE IF NOT EXISTS entries (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  return db;
});

export const localCache: LocalCache = {
  get: async (key) => (await (await opened).getFirstAsync<{ value: string }>("SELECT value FROM entries WHERE key = ?", [key]))?.value,
  set: async (key, value) => void (await (await opened).runAsync("INSERT OR REPLACE INTO entries (key, value) VALUES (?, ?)", [key, value])),
  clear: async () => void (await (await opened).execAsync("DELETE FROM entries")),
};

import { pruneBackups, writeBackup } from "./backup/backup.ts";
import { BotRegistry } from "./bots/bot-registry.ts";
import { dataPaths, loadConfig } from "./config.ts";
import { openDatabase } from "./store/database.ts";

// Writes one backup now, without starting the server: `pnpm --filter @botsman/server backup`.
const config = loadConfig();
const db = openDatabase(dataPaths(config.dataDir).serverDb);
const botFolders = new BotRegistry(db).allFolders();
const target = await writeBackup({ dataDir: config.dataDir, serverDb: db, botFolders }, config.backupDir);
pruneBackups(config.backupDir, config.backupKeep);
db.close();
console.log(`backup written to ${target}`);

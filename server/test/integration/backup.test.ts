import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pruneBackups } from "../../src/backup/backup.ts";
import { msUntilHour, runBackup } from "../../src/backup/nightly.ts";
import { setUpServer, startTestServer, type TestServer } from "../helpers.ts";

describe("backups", () => {
  let server: TestServer;
  let botId: string;
  let outside: string;

  beforeAll(async () => {
    server = await startTestServer();
    botId = await setUpServer(server);
    outside = path.join(server.root.root, "disk2", "repo");
    const bot = await server.client.createBot({ name: "Outside", folder: outside });
    writeFileSync(path.join(bot.folder, "work.txt"), "important");
    await server.client.request("PUT", `/api/bots/${botId}/notes/plan.md`, { content: "the plan" });
    await server.client.send(botId, "hello");
  });

  afterAll(async () => {
    await server?.botsman.stop();
    server?.root.cleanup();
  });

  it("copies the databases, memory files, notes, and bot folders, but not the secret key", async () => {
    const target = await runBackup(server.botsman.services);
    const data = path.join(target, "data");
    expect(existsSync(path.join(data, "secret.key"))).toBe(false);
    expect(existsSync(path.join(data, "bots", botId, "BOT_PROFILE.md"))).toBe(true);
    expect(existsSync(path.join(data, "bots", botId, "notes", "plan.md"))).toBe(true);
    const db = new DatabaseSync(path.join(data, "server.db"), { readOnly: true });
    expect((db.prepare("SELECT count(*) AS n FROM bots").get() as { n: number }).n).toBe(2);
    db.close();
    const session = new DatabaseSync(path.join(data, "bots", botId, "session.sqlite"), { readOnly: true });
    expect(session.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().length).toBeGreaterThan(0);
    session.close();
    const folders = readdirSync(path.join(target, "folders"));
    expect(folders).toHaveLength(1);
    expect(existsSync(path.join(target, "folders", folders[0]!, "work.txt"))).toBe(true);
  });

  it("still copies a deleted bot's folder that sits outside the data folder", async () => {
    const extra = path.join(server.root.root, "disk3", "repo");
    const bot = await server.client.createBot({ name: "Gone", folder: extra });
    writeFileSync(path.join(bot.folder, "kept.txt"), "still here");
    await server.client.request("DELETE", `/api/bots/${bot.id}`);
    const target = await runBackup(server.botsman.services);
    expect(existsSync(path.join(target, "folders", bot.id, "kept.txt"))).toBe(true);
  });

  it("keeps only the newest backups", () => {
    const dir = path.join(server.root.root, "prune");
    for (const name of ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04.partial"]) mkdirSync(path.join(dir, name), { recursive: true });
    pruneBackups(dir, 2);
    expect(readdirSync(dir).sort()).toEqual(["2026-01-02", "2026-01-03", "2026-01-04.partial"]);
  });

  it("schedules the next run at the configured hour", () => {
    const now = new Date(2026, 10, 9, 13, 0, 0);
    expect(msUntilHour(3, now)).toBe(14 * 3_600_000);
    expect(msUntilHour(14, now)).toBe(3_600_000);
  });
});

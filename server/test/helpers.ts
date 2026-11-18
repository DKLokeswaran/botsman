import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Config } from "../src/config.ts";
import { type Botsman, startBotsman } from "../src/server.ts";
import { SCRIPT_MODEL, SCRIPT_PROVIDER } from "../src/testing/script-model.ts";
import { BotsmanClient } from "./e2e/client.ts";

export const PASSWORD = "correct horse battery staple";
export const SCRIPT_MODEL_REF = { provider: SCRIPT_PROVIDER, modelId: SCRIPT_MODEL };

// A temporary root with a fake home folder, so folder rules and sandboxes never touch the real home.
export function tempRoot(): { root: string; home: string; dataDir: string; cleanup: () => void } {
  const root = mkdtempSync(path.join(tmpdir(), "botsman-test-"));
  const home = path.join(root, "home");
  mkdirSync(home, { recursive: true });
  return { root, home, dataDir: path.join(home, ".botsman"), cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

export function testConfig(home: string, dataDir: string, root: string): Config {
  return {
    dataDir,
    homeDir: home,
    host: "127.0.0.1",
    port: 0,
    trustProxy: ["127.0.0.1", "::1"],
    backupDir: path.join(root, "backups"),
    backupHour: 3,
    backupKeep: 3,
    scriptModel: true,
    dashboardDir: path.join(root, "dashboard"),
    commit: undefined,
    branch: undefined,
    preview: false,
    releaseCheck: false,
  };
}

export type TestServer = { botsman: Botsman; client: BotsmanClient; baseUrl: string; root: ReturnType<typeof tempRoot> };

export async function startTestServer(root = tempRoot()): Promise<TestServer> {
  const botsman = await startBotsman(testConfig(root.home, root.dataDir, root.root), { backups: false, log: () => {} });
  const { port } = botsman.http.server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  return { botsman, client: new BotsmanClient(baseUrl), baseUrl, root };
}

// Sets the server up with the main bot on the scripted model, ready to chat.
export async function setUpServer(server: TestServer): Promise<string> {
  await server.client.setup(PASSWORD, { name: "Main", purpose: "Help the owner.", defaultModel: SCRIPT_MODEL_REF });
  await server.client.saveKey(SCRIPT_PROVIDER, "test-key");
  const { bots } = await server.client.bots();
  return bots[0]!.id;
}

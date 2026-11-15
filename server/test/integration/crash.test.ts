import { type ChildProcess, execSync, spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import type { ChatHistoryPage } from "@botsman/protocol";
import { afterEach, describe, expect, it } from "vitest";
import { BotsmanClient } from "../e2e/client.ts";
import { PASSWORD, SCRIPT_MODEL_REF, tempRoot } from "../helpers.ts";

const MAIN = path.join(import.meta.dirname, "../../src/main.ts");

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const probe = createServer().listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });
}

// The real server in its own process, so the test can kill it the way a crash would.
async function startProcess(root: ReturnType<typeof tempRoot>, port: number): Promise<ChildProcess> {
  const child = spawn(process.execPath, [MAIN], {
    env: { ...process.env, HOME: root.home, BOTSMAN_DATA_DIR: root.dataDir, BOTSMAN_PORT: String(port), BOTSMAN_SCRIPT_MODEL: "1", BOTSMAN_BACKUP_DIR: path.join(root.root, "backups") },
    stdio: "ignore",
  });
  const client = new BotsmanClient(`http://127.0.0.1:${port}`);
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const healthy = await client.raw("GET", "/api/health").then((response) => response.ok, () => false);
    if (healthy) return child;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill("SIGKILL");
  throw new Error("server did not start");
}

async function waitUntil(check: () => Promise<boolean> | boolean, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("condition not met in time");
}

const running = (pattern: string) => execSync(`pgrep -f '${pattern}' || true`, { encoding: "utf8" }).trim() !== "";

describe("crash recovery", () => {
  const children: ChildProcess[] = [];
  const roots: ReturnType<typeof tempRoot>[] = [];

  afterEach(() => {
    for (const child of children.splice(0)) child.kill("SIGKILL");
    for (const root of roots.splice(0)) root.cleanup();
  });

  async function boot() {
    const root = tempRoot();
    roots.push(root);
    const port = await freePort();
    children.push(await startProcess(root, port));
    const client = new BotsmanClient(`http://127.0.0.1:${port}`);
    await client.setup(PASSWORD, { name: "Main", defaultModel: SCRIPT_MODEL_REF });
    await client.saveKey(SCRIPT_MODEL_REF.provider, "test-key");
    const botId = (await client.bots()).bots[0]!.id;
    return { root, port, client, botId };
  }

  async function restart(root: ReturnType<typeof tempRoot>, port: number): Promise<void> {
    children.pop()!.kill("SIGKILL");
    await new Promise((resolve) => setTimeout(resolve, 300));
    children.push(await startProcess(root, port));
  }

  async function history(client: BotsmanClient, botId: string): Promise<ChatHistoryPage> {
    return client.request("GET", `/api/bots/${botId}/chat/history?limit=200`);
  }

  it("keeps a memory proposal across a kill, and the resumed tool call returns the owner's answer", async () => {
    const { root, port, client, botId } = await boot();
    await client.send(botId, 'tool memory {"action":"propose_memory_edit","content":"Survives restarts."}');
    await waitUntil(async () => (await client.proposals()).proposals.length === 1);
    await restart(root, port);
    await client.login(PASSWORD);
    const { proposals } = await client.proposals();
    expect(proposals).toHaveLength(1);
    await client.answerProposal(proposals[0]!.id, "accept");
    await waitUntil(async () => (await history(client, botId)).messages.some((message) => message.type === "tool_result"));
    const results = (await history(client, botId)).messages.filter((message) => message.type === "tool_result");
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ isError: false, output: expect.stringContaining("accepted") });
    expect((await client.proposals("pending")).proposals).toHaveLength(0);
  });

  it("keeps an approval across a kill, and runs the tool exactly once after it is allowed", async () => {
    const { root, port, client, botId } = await boot();
    await client.send(botId, 'tool read {"path":"/etc/hostname"}');
    await waitUntil(async () => (await client.approvals()).approvals.length === 1);
    await restart(root, port);
    await client.login(PASSWORD);
    const [approval] = (await client.approvals()).approvals;
    expect(approval).toMatchObject({ status: "pending", toolName: "read" });
    await client.answerApproval(approval!.id, "allow_once");
    await waitUntil(async () => (await history(client, botId)).messages.some((message) => message.type === "assistant" && message.text.startsWith("tool read returned")));
    const results = (await history(client, botId)).messages.filter((message) => message.type === "tool_result");
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ isError: false });
  });

  it("ends every sandboxed process when the server is killed, and the chat carries on after restart", async () => {
    const { root, port, client, botId } = await boot();
    await client.send(botId, 'tool bash {"command":"sleep 3073"}');
    await waitUntil(() => running("^sleep 3073"));
    await restart(root, port);
    expect(running("^sleep 3073")).toBe(false);
    await client.login(PASSWORD);
    await waitUntil(async () => (await history(client, botId)).messages.some((message) => message.type === "tool_result"));
    const interrupted = (await history(client, botId)).messages.find((message) => message.type === "tool_result");
    expect(interrupted).toMatchObject({ isError: true });
    expect(running("^sleep 3073")).toBe(false);
    await client.send(botId, "still there?");
    await waitUntil(async () => (await history(client, botId)).messages.some((message) => message.type === "assistant" && message.text === "echo: still there?"));
  });
});

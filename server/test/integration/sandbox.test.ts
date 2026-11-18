import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BACKGROUND_CONTEXT as context } from "@earendil-works/chord/context";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SandboxManager } from "../../src/sandbox/sandbox-manager.ts";
import { tempRoot } from "../helpers.ts";

const sleepPids = () => execSync("pgrep -f '^sleep 3071' || true", { encoding: "utf8" }).trim();

const root = tempRoot();
const folder = path.join(root.root, "bot folder");
const sandbox = new SandboxManager({ skillsDir: path.join(root.dataDir, "skills"), agentsDir: path.join(root.home, ".agents") });

async function run(command: string, network = false): Promise<{ code: number; output: string }> {
  const env = sandbox.envFor({ botId: network ? "net" : "bot", folder, network });
  let output = "";
  const result = await env.exec(command, { onOutput: (text) => void (output += text) }, context);
  if (!result.ok) throw new Error(String(result.error.message));
  return { code: result.value.exitCode, output };
}

describe.skipIf(!sandbox.status.ok)("bot sandbox", () => {
  beforeAll(() => {
    mkdirSync(path.join(root.home, ".ssh"), { recursive: true });
    writeFileSync(path.join(root.home, ".ssh", "id_ed25519"), "secret");
    mkdirSync(path.join(root.dataDir, "bots"), { recursive: true });
    mkdirSync(path.join(root.home, ".agents", "skills", "demo"), { recursive: true });
    writeFileSync(path.join(root.home, ".agents", "skills", "demo", "SKILL.md"), "# demo");
  });

  afterAll(() => {
    sandbox.stopAll();
    root.cleanup();
  });

  it("starts at server start", () => {
    expect(sandbox.status).toEqual({ ok: true, reason: null });
  });

  it("gives the bot its folder as HOME, writable, and a clean environment", async () => {
    const { output } = await run('echo "$HOME" && touch made-here && ls && env | cut -d= -f1 | sort | tr "\\n" " "');
    expect(output).toContain(folder);
    expect(output).toContain("made-here");
    expect(output).toMatch(/^.*HOME PATH .*TMPDIR/m);
    expect(output).not.toMatch(/BOTSMAN|NODE|USER=/);
  });

  it("hides the owner's home, keys, Botsman's data, and the rest of the system", async () => {
    const { output } = await run(
      `for p in /home "${root.home}/.ssh/id_ed25519" "${root.dataDir}" /sys /root /var; do test -e "$p" && echo "visible $p" || echo "hidden $p"; done`,
    );
    expect(output).not.toContain("visible");
  });

  it("shows the owner's skills read-only", async () => {
    const { output } = await run(`cat "${root.home}/.agents/skills/demo/SKILL.md"; touch "${root.home}/.agents/x" 2>&1 || true`);
    expect(output).toContain("# demo");
    expect(output).toContain("Read-only file system");
  });

  it("refuses writes outside its folder and /tmp, instead of keeping them in memory", async () => {
    const { output } = await run(`touch /tmp/scratch && echo "tmp ok"; mkdir /escape 2>&1; touch /outside 2>&1; true`);
    expect(output).toContain("tmp ok");
    expect(output.match(/Read-only file system/g)).toHaveLength(2);
  });

  it("can't write system folders or gain privileges", async () => {
    const { output } = await run("touch /etc/botsman 2>&1; touch /usr/botsman 2>&1; grep CapEff /proc/self/status");
    expect(output).toMatch(/Read-only file system/);
    expect(output).toMatch(/CapEff:\s+0+\s/);
  });

  it("has only its own loopback with the network off, and the host's network with it on", async () => {
    const off = await run("tail -n +3 /proc/net/dev | cut -d: -f1 | tr -d ' '");
    expect(off.output.trim()).toBe("lo");
    const on = await run("tail -n +3 /proc/net/dev | cut -d: -f1 | tr -d ' '", true);
    expect(on.output.trim().split("\n").length).toBeGreaterThan(1);
  });

  it("stop ends every process the bot started, even one that left its group", async () => {
    await run("setsid sleep 3071 > /dev/null 2>&1 < /dev/null & echo started");
    // The command returns before the background process has finished starting, so wait for it to show up.
    await vi.waitFor(() => expect(sleepPids()).not.toBe(""));
    sandbox.stop("bot");
    await vi.waitFor(() => expect(sleepPids()).toBe(""));
    const after = await run("echo fresh sandbox; ls /tmp | wc -l");
    expect(after.output).toContain("fresh sandbox");
  });
});

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Connection, localDaemon, RemoteExecutionEnv } from "@earendil-works/pi-env";
import { SANDBOX_DAEMON, sandboxArgs, type SandboxSpec } from "./bwrap-args.ts";

export type SandboxStatus = { readonly ok: boolean; readonly reason: string | null };

export type BotSandboxSettings = { readonly botId: string; readonly folder: string; readonly network: boolean };

type Live = { readonly key: string; readonly connection: Connection };

// One bubblewrap sandbox per bot, holding a pi-env daemon that runs the bot's file and shell tools.
// The sandbox starts on the bot's first tool call. Stopping the bot closes the connection, which ends the sandbox
// and every process in it.
export class SandboxManager {
  readonly status: SandboxStatus;
  readonly #bwrap: string;
  readonly #daemon = localDaemon();
  readonly #skillsDir: string;
  readonly #agentsDir: string;
  readonly #live = new Map<string, Live>();

  constructor(options: { skillsDir: string; agentsDir: string; bwrap?: string }) {
    this.#bwrap = options.bwrap ?? "bwrap";
    this.#skillsDir = options.skillsDir;
    this.#agentsDir = options.agentsDir;
    this.status = this.#check();
  }

  // The execution environment for a bot's tools. Settings that change the sandbox start a new one.
  envFor(bot: BotSandboxSettings): RemoteExecutionEnv {
    if (!this.status.ok) throw new Error(`Sandboxes are unavailable: ${this.status.reason}`);
    mkdirSync(bot.folder, { recursive: true });
    const live = this.#connection(bot);
    return new RemoteExecutionEnv({ connection: live.connection, id: `sandbox:${bot.botId}`, cwd: bot.folder });
  }

  // Ends the bot's sandbox and everything running in it. The next tool call starts a fresh one.
  stop(botId: string): void {
    const live = this.#live.get(botId);
    if (live === undefined) return;
    this.#live.delete(botId);
    live.connection.close();
  }

  stopAll(): void {
    for (const botId of [...this.#live.keys()]) this.stop(botId);
  }

  #connection(bot: BotSandboxSettings): Live {
    const key = `${bot.folder}\0${bot.network}`;
    const current = this.#live.get(bot.botId);
    if (current?.key === key) return current;
    if (current !== undefined) this.stop(bot.botId);
    const command = [this.#bwrap, ...sandboxArgs(this.#spec(bot.folder, bot.network)), "--", SANDBOX_DAEMON];
    const live = { key, connection: new Connection({ command }) };
    this.#live.set(bot.botId, live);
    return live;
  }

  #spec(folder: string, network: boolean): SandboxSpec {
    return { folder, network, daemon: this.#daemon, agentsDir: this.#agentsDir, skillsDir: this.#skillsDir };
  }

  // Starts one throwaway sandbox at startup. Bots never run unsandboxed, so a failure stops all bot work.
  #check(): SandboxStatus {
    const folder = mkdtempSync(path.join(tmpdir(), "botsman-check-"));
    try {
      const result = spawnSync(this.#bwrap, [...sandboxArgs(this.#spec(folder, false)), "--", "/usr/bin/true"], { encoding: "utf8", timeout: 10_000 });
      if (result.error) return { ok: false, reason: `bwrap could not start: ${result.error.message}. Install bubblewrap.` };
      if (result.status !== 0) return { ok: false, reason: explainFailure(result.stderr) };
      return { ok: true, reason: null };
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  }
}

function explainFailure(stderr: string): string {
  const detail = stderr.trim();
  if (/setting up uid map|Permission denied|Operation not permitted/i.test(detail)) {
    return `bwrap can't create a user namespace (${detail}). On Ubuntu 24.04 and later, install the AppArmor profile from deploy/apparmor-bwrap.`;
  }
  return `bwrap failed: ${detail}`;
}

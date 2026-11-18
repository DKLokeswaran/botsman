import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { compareVersions } from "@botsman/protocol";

const CHECK_EVERY_MS = 24 * 3_600_000;
const REPO_DIR = path.join(import.meta.dirname, "..", "..", "..");
const RELEASE_TAG = /^refs\/tags\/server-v(\d+\.\d+\.\d+)$/;

// The tag refs on the git remote this checkout came from, so a fork sees its own releases.
export async function remoteServerTags(): Promise<string[]> {
  const { stdout } = await promisify(execFile)("git", ["ls-remote", "--tags", "--refs", "origin", "server-v*"], { cwd: REPO_DIR, timeout: 30_000 });
  return stdout.split("\n").map((line) => line.split("\t")[1] ?? "");
}

// The newest version among `refs/tags/server-v<major>.<minor>.<patch>` refs.
export function newestServerVersion(refs: readonly string[]): string | undefined {
  return refs
    .flatMap((ref) => RELEASE_TAG.exec(ref)?.[1] ?? [])
    .sort(compareVersions)
    .at(-1);
}

// The newest server release, checked at startup and then once a day. A failed check, for example with no network,
// keeps the last answer.
export class LatestRelease {
  #version: string | undefined;
  #timer: ReturnType<typeof setInterval> | undefined;
  readonly #listTags: () => Promise<string[]>;

  constructor(listTags: () => Promise<string[]> = remoteServerTags) {
    this.#listTags = listTags;
  }

  get version(): string | undefined {
    return this.#version;
  }

  start(): void {
    void this.check();
    this.#timer = setInterval(() => void this.check(), CHECK_EVERY_MS);
    this.#timer.unref();
  }

  async check(): Promise<void> {
    try {
      this.#version = newestServerVersion(await this.#listTags()) ?? this.#version;
    } catch {
      // The next check tries again.
    }
  }

  stop(): void {
    clearInterval(this.#timer);
  }
}

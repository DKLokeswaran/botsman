import { type ProtocolRange, protocolFit } from "@botsman/protocol";
import { Store } from "./store.ts";

// What a release says about its newest build. Each app reads it from the repo's `updates` release.
export type UpdateManifest = { version: string; protocol: number };

// The newest build an app found, with the way to install it.
export type AvailableBuild = UpdateManifest & { install(): Promise<void> };

// What each app supplies to update itself: Tauri's updater on Windows, a download and install on Android.
// The web dashboard has none, because it comes with the server.
export type AppUpdater = {
  installedVersion(): Promise<string>;
  latest(): Promise<AvailableBuild | undefined>;
};

export type UpdateState =
  | { status: "none" }
  | { status: "available"; version: string }
  | { status: "installing"; version: string }
  | { status: "failed"; version: string; error: string };

// Compares two `major.minor.patch` versions: negative when the first is older.
export function compareVersions(first: string, second: string): number {
  const [a, b] = [first, second].map((version) => version.split(".").map((part) => Number.parseInt(part, 10) || 0));
  for (let index = 0; index < 3; index += 1) {
    const difference = (a![index] ?? 0) - (b![index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

// A build is worth offering when it is newer than the installed one and the connected server speaks its protocol.
// With no server yet, any newer build is offered.
export function isOffered(manifest: UpdateManifest, installedVersion: string, server: ProtocolRange | undefined): boolean {
  if (compareVersions(manifest.version, installedVersion) <= 0) return false;
  return server === undefined || protocolFit(manifest.protocol, server) === "fits";
}

// Looks for a newer build of the app and installs it when the owner asks.
export class UpdateChecker {
  readonly state = new Store<UpdateState>({ status: "none" });
  readonly #updater: AppUpdater;
  #offered: AvailableBuild | undefined;

  constructor(updater: AppUpdater) {
    this.#updater = updater;
  }

  // A check that fails, for example with no network, leaves things as they were.
  async check(server: ProtocolRange | undefined): Promise<void> {
    if (this.state.get().status === "installing") return;
    try {
      const [build, installed] = await Promise.all([this.#updater.latest(), this.#updater.installedVersion()]);
      this.#offered = build !== undefined && isOffered(build, installed, server) ? build : undefined;
      this.state.set(this.#offered === undefined ? { status: "none" } : { status: "available", version: this.#offered.version });
    } catch {
      // The next check tries again.
    }
  }

  async install(): Promise<void> {
    const build = this.#offered;
    if (build === undefined) return;
    this.state.set({ status: "installing", version: build.version });
    try {
      await build.install();
    } catch (error) {
      this.state.set({ status: "failed", version: build.version, error: error instanceof Error ? error.message : "The update couldn't be installed" });
    }
  }
}

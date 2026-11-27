import { compareVersions, type ProtocolRange, protocolFit } from "@botsman/protocol";

export { compareVersions } from "@botsman/protocol";
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

// A build is worth offering when it is newer than the installed one and the connected server speaks its protocol.
// With no server yet, any newer build is offered.
export function isOffered(manifest: UpdateManifest, installedVersion: string, server: ProtocolRange | undefined): boolean {
  if (compareVersions(manifest.version, installedVersion) <= 0) return false;
  return server === undefined || protocolFit(manifest.protocol, server) === "fits";
}

// What settings shows about this app's version: the installed one, whether a check is running, when the last one
// finished, and why the last one failed.
export type UpdateInfo = { installed: string | undefined; checking: boolean; checkedAt: number | undefined; error: string | undefined };

const RECHECK_EVERY_MS = 6 * 3_600_000;

// Looks for a newer build of the app and installs it when the owner asks. It checks when the app connects, again
// every six hours while it runs, and whenever the owner asks.
export class UpdateChecker {
  readonly state = new Store<UpdateState>({ status: "none" });
  readonly info = new Store<UpdateInfo>({ installed: undefined, checking: false, checkedAt: undefined, error: undefined });
  // The version the owner answered "Not now" to, so the dialog doesn't ask again until a newer one appears.
  readonly declined = new Store<string | undefined>(undefined);
  readonly #updater: AppUpdater;
  #offered: AvailableBuild | undefined;
  #server: ProtocolRange | undefined;
  #timer: ReturnType<typeof setInterval> | undefined;

  constructor(updater: AppUpdater) {
    this.#updater = updater;
    void updater.installedVersion().then((installed) => this.info.update((info) => ({ ...info, installed })), () => undefined);
  }

  // Checks against the connected server's protocol range, and keeps checking every six hours.
  async check(server: ProtocolRange | undefined): Promise<void> {
    this.#server = server;
    this.#timer ??= setInterval(() => void this.checkNow(), RECHECK_EVERY_MS);
    await this.checkNow();
  }

  // A check the owner asks for. One that fails, for example with no network, keeps any offer it had and says why.
  async checkNow(): Promise<void> {
    if (this.state.get().status === "installing" || this.info.get().checking) return;
    this.info.update((info) => ({ ...info, checking: true, error: undefined }));
    try {
      const [build, installed] = await Promise.all([this.#updater.latest(), this.#updater.installedVersion()]);
      this.#offered = build !== undefined && isOffered(build, installed, this.#server) ? build : undefined;
      this.state.set(this.#offered === undefined ? { status: "none" } : { status: "available", version: this.#offered.version });
      this.info.set({ installed, checking: false, checkedAt: Date.now(), error: undefined });
    } catch (error) {
      this.info.update((info) => ({ ...info, checking: false, error: error instanceof Error ? error.message : "Couldn't check for updates" }));
    }
  }

  notNow(): void {
    const state = this.state.get();
    if (state.status === "available") this.declined.set(state.version);
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

// An update as the dialog and the notice show it. `install` is the button's label, undefined while the update installs.
export type UpdateView = { title: string; message: string; notice: string; error: string | undefined; install: string | undefined };

// What to show for an update, or undefined when there is none. `installingNote` is what the app's platform does while
// it installs.
export function updateView(state: UpdateState, installed: string | undefined, installingNote: string): UpdateView | undefined {
  if (state.status === "none") return undefined;
  if (state.status === "installing") return { title: "Installing", message: `Installing ${state.version}. ${installingNote}`, notice: `Installing ${state.version}…`, error: undefined, install: undefined };
  const notice = `Version ${state.version} is ready to install.`;
  const current = installed === undefined ? "" : ` You're on ${installed}.`;
  const failed = state.status === "failed";
  return { title: "Update available", message: notice + current, notice, error: failed ? state.error : undefined, install: failed ? "Try again" : "Install" };
}

// What the screen that blocks the app says, by the side the owner has to update.
export const UPDATE_NEEDED = {
  update_app: { title: "Update the app", lede: "This app is too old for your server. Install the newest version of the app, then open it again." },
  update_server: { title: "Update the server", lede: "Your server is older than this app. Update the server, then try again." },
} as const;

// The version line in settings, such as "Botsman 0.1.6 · Up to date".
export function versionLine(appName: string, info: UpdateInfo, state: UpdateState): string {
  const name = info.installed === undefined ? appName : `${appName} ${info.installed}`;
  if (info.checking) return `${name} · Checking for updates…`;
  if (info.error !== undefined) return `${name} · Couldn't check: ${info.error}`;
  if (state.status !== "none") return `${name} · Version ${state.version} is available`;
  if (info.checkedAt === undefined) return name;
  return `${name} · Up to date, checked at ${new Date(info.checkedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

// Whether the "Update available" dialog should ask: a build is ready, or installing or failed, and the owner hasn't
// said "Not now" to this version.
export function asksToUpdate(state: UpdateState, declined: string | undefined): boolean {
  return state.status !== "none" && !(state.status === "available" && state.version === declined);
}

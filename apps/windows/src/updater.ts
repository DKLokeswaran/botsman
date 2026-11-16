import type { AppUpdater } from "@botsman/client-core";
import { getVersion } from "@tauri-apps/api/app";
import { check } from "@tauri-apps/plugin-updater";

// Updates the app through Tauri's updater, which reads the manifest named in tauri.conf.json and refuses a
// build whose signature doesn't match the app's public key. The app closes while the installer runs.
export const updater: AppUpdater = {
  installedVersion: () => getVersion(),
  latest: async () => {
    const update = await check();
    if (update === null) return undefined;
    const protocol = Number((update.rawJson as { protocol?: unknown }).protocol ?? 0);
    return { version: update.version, protocol, install: () => update.downloadAndInstall() };
  },
};

import type { AppUpdater, UpdateManifest } from "@botsman/client-core";
import Constants from "expo-constants";
import { BotsmanUpdates } from "../modules/botsman-updates";

type AndroidManifest = UpdateManifest & { url: string; sha256: string };

// Where the newest Android build is announced. A fork sets its own address in app.json.
const MANIFEST_URL = String(Constants.expoConfig?.extra?.updateManifestUrl ?? "");

// Updates the app from the repo's releases: read the manifest, download the APK, check its digest, and install.
export const updater: AppUpdater = {
  installedVersion: async () => BotsmanUpdates.installedVersion(),
  latest: async () => {
    const manifest = await readManifest();
    return manifest === undefined ? undefined : { version: manifest.version, protocol: manifest.protocol, install: () => install(manifest) };
  },
};

async function readManifest(): Promise<AndroidManifest | undefined> {
  if (MANIFEST_URL === "") return undefined;
  const response = await fetch(MANIFEST_URL, { headers: { "cache-control": "no-cache" } });
  return response.ok ? ((await response.json()) as AndroidManifest) : undefined;
}

// Android asks the owner once to let this app install builds. Until they do, the install opens that setting.
async function install(manifest: AndroidManifest): Promise<void> {
  if (!BotsmanUpdates.canInstall()) {
    BotsmanUpdates.openInstallSettings();
    throw new Error("Allow Botsman to install apps, then press Install again.");
  }
  await BotsmanUpdates.downloadAndInstall(manifest.url, manifest.sha256);
}

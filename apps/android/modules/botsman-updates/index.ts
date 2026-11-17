import { requireNativeModule } from "expo";

type BotsmanUpdatesModule = {
  installedVersion(): string;
  canInstall(): boolean;
  openInstallSettings(): void;
  downloadAndInstall(url: string, sha256: string): Promise<void>;
};

// The Kotlin module in ./android.
export const BotsmanUpdates = requireNativeModule<BotsmanUpdatesModule>("BotsmanUpdates");

import { requireNativeModule } from "expo";

type Status = { running: boolean; connected: boolean; notificationsAllowed: boolean; batteryUnrestricted: boolean; maker: string };

type BotsmanAlertsModule = {
  deviceSummary(): string;
  isEnabled(): boolean;
  setEnabled(enabled: boolean): void;
  start(server: string, token: string, templates: Record<string, string>): void;
  stop(): void;
  setBotNames(names: Record<string, string>): void;
  setAppInFront(inFront: boolean): void;
  status(): Status;
  openBatterySettings(): void;
  openNotificationSettings(): void;
};

// The Kotlin module in ./android: the background alerts connection and the phone settings around it.
export const BotsmanAlerts = requireNativeModule<BotsmanAlertsModule>("BotsmanAlerts");

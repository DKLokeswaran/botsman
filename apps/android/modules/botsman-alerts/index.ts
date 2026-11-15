import { requireNativeModule } from "expo";

type BotsmanAlertsModule = {
  deviceSummary(): string;
};

// The Kotlin module in ./android.
export const BotsmanAlerts = requireNativeModule<BotsmanAlertsModule>("BotsmanAlerts");

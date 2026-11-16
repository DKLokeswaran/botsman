import type { BackgroundAlertsService } from "@botsman/client-core";
import { AppState, PermissionsAndroid, Platform } from "react-native";
import { BotsmanAlerts } from "../modules/botsman-alerts";

// While the app is in front, its own screens show what needs the owner, so the service stays quiet.
BotsmanAlerts.setAppInFront(AppState.currentState === "active");
AppState.addEventListener("change", (state) => BotsmanAlerts.setAppInFront(state === "active"));

// Android 13 and later ask the owner before an app may post notifications.
async function askForNotifications(): Promise<void> {
  if (Platform.OS === "android" && Number(Platform.Version) >= 33) await PermissionsAndroid.request("android.permission.POST_NOTIFICATIONS");
}

// The Kotlin foreground service, as the shared logic sees it.
export const backgroundAlerts: BackgroundAlertsService = {
  isEnabled: async () => BotsmanAlerts.isEnabled(),
  start: async (server, token, templates) => {
    await askForNotifications();
    BotsmanAlerts.start(server, token, templates);
  },
  stop: async () => BotsmanAlerts.stop(),
  setEnabled: async (enabled) => BotsmanAlerts.setEnabled(enabled),
  setBotNames: async (names) => BotsmanAlerts.setBotNames(names),
  status: async () => BotsmanAlerts.status(),
};

// Opens the phone settings the background connection depends on.
export const phoneSettings = {
  battery: () => BotsmanAlerts.openBatterySettings(),
  notifications: () => BotsmanAlerts.openNotificationSettings(),
};

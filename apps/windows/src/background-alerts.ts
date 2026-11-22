import type { BackgroundAlertsService } from "@botsman/pc-ui";
import { invoke } from "@tauri-apps/api/core";

// The alerts connection in Rust, which keeps running while the window is hidden in the tray.
export const backgroundAlerts: BackgroundAlertsService = {
  isEnabled: () => invoke<boolean>("alerts_is_enabled"),
  start: (server, token, templates) => invoke("alerts_start", { server, token, templates }),
  stop: () => invoke("alerts_stop"),
  setEnabled: (enabled) => invoke("alerts_set_enabled", { enabled }),
  setBotNames: (names) => invoke("alerts_set_bot_names", { names }),
  status: async () => ({ ...(await invoke<{ running: boolean; connected: boolean }>("alerts_status")), notificationsAllowed: null, batteryUnrestricted: null, maker: null }),
};

// Starting with Windows, hidden in the tray.
export const autostart = {
  isEnabled: () => invoke<boolean>("autostart_is_enabled"),
  set: (enabled: boolean) => invoke<void>("autostart_set", { enabled }),
};

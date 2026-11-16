import type { NotificationPermission, PageNotifications } from "./platform.ts";

// Page notifications through the browser's Notification API, where it exists.
export const browserNotifications: PageNotifications = {
  permission: () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission),
  ask: async () => (typeof Notification === "undefined" ? "unsupported" : ((await Notification.requestPermission()) as NotificationPermission)),
  show: (title, body, onClick) => {
    const notification = new Notification(title, { body });
    notification.onclick = () => {
      onClick();
      notification.close();
    };
  },
};

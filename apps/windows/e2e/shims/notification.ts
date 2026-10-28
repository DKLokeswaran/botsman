import { notificationHandlers, type NotificationAction } from "./bridge";

export async function isPermissionGranted(): Promise<boolean> {
  return true;
}

export async function requestPermission(): Promise<"granted"> {
  return "granted";
}

export async function sendNotification(_options: { title?: string; body?: string; extra?: Record<string, unknown> }): Promise<void> {
  return undefined;
}

export async function onAction(handler: (event: NotificationAction) => void): Promise<{ unregister: () => Promise<void> }> {
  notificationHandlers.push(handler);
  return {
    async unregister() {
      const index = notificationHandlers.indexOf(handler);
      if (index >= 0) {
        notificationHandlers.splice(index, 1);
      }
    },
  };
}

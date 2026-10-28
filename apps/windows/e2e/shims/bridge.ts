import { SHIM_MARKER } from "../constants";

export type NotificationAction = {
  notification?: { extra?: { route?: string } };
};

type TrayHandler = (event: { payload: unknown }) => void;

export const notificationHandlers: Array<(event: NotificationAction) => void> = [];
const trayHandlers = new Map<string, Set<TrayHandler>>();

export type E2EBridge = {
  marker: string;
  tapNotification: (route: string) => void;
};

declare global {
  interface Window {
    __hermesE2e?: E2EBridge;
  }
}

export function installBridge(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.__hermesE2e = {
    marker: SHIM_MARKER,
    tapNotification(route: string) {
      if (notificationHandlers.length === 0) {
        throw new Error("no notification action handler");
      }
      const event: NotificationAction = { notification: { extra: { route } } };
      for (const handler of [...notificationHandlers]) {
        handler(event);
      }
    },
  };
}

export function addTrayListener(event: string, handler: TrayHandler): () => void {
  const set = trayHandlers.get(event) ?? new Set<TrayHandler>();
  set.add(handler);
  trayHandlers.set(event, set);
  return () => {
    set.delete(handler);
  };
}

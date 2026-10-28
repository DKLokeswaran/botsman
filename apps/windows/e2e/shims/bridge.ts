import { SHIM_MARKER } from "../constants";
import { foregroundCount, setWindowHidden } from "./window";

export type NotificationAction = {
  actionId?: string;
  inputValue?: string | null;
  notification?: { extra?: { route?: string } };
  extra?: { route?: string };
};

type TrayHandler = (event: { payload: unknown }) => void;

export const notificationHandlers: Array<(event: NotificationAction) => void> = [];
const trayHandlers = new Map<string, Set<TrayHandler>>();
let lastNotificationRoute: string | null = null;

export function recordNotificationRoute(route: string | null): void {
  lastNotificationRoute = route;
}

export type E2EBridge = {
  marker: string;
  tapNotification: (route: string) => void;
  setHidden: (hidden: boolean) => void;
  foregrounds: () => number;
  lastNotificationRoute: () => string;
  clickNotification: () => void;
};

declare global {
  interface Window {
    __hermesE2e?: E2EBridge;
  }
}

function deliver(event: NotificationAction): void {
  if (notificationHandlers.length === 0) {
    throw new Error("no notification action handler");
  }
  for (const handler of [...notificationHandlers]) {
    handler(event);
  }
}

export function installBridge(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.__hermesE2e = {
    marker: SHIM_MARKER,
    tapNotification(route: string) {
      deliver({ notification: { extra: { route } } });
    },
    setHidden(hidden: boolean) {
      setWindowHidden(hidden);
    },
    foregrounds() {
      return foregroundCount();
    },
    lastNotificationRoute() {
      return lastNotificationRoute ?? "";
    },
    clickNotification() {
      const route = lastNotificationRoute;
      if (!route) {
        throw new Error("no notification route");
      }
      deliver({ actionId: "tap", inputValue: null, notification: { extra: { route } } });
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

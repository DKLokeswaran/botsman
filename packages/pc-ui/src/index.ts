export { App } from "./app.tsx";
export type { Platform } from "./platform.ts";
export { browserNotifications } from "./browser-notifications.ts";
export { indexedDbCache } from "./indexed-db-cache.ts";

// client-core's types, protocol's included, for the shells. Only types: its logic stays behind the screens.
export type * from "@botsman/client-core";

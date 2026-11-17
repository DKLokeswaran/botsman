import type { AppEnvironment } from "@botsman/client-core";

export type NotificationPermission = "granted" | "denied" | "default" | "unsupported";

// Notifications the page shows itself while it is open. The web dashboard has them; the Windows app notifies from
// Rust instead, so it leaves them out.
export type PageNotifications = {
  permission(): NotificationPermission;
  ask(): Promise<NotificationPermission>;
  show(title: string, body: string, onClick: () => void): void;
};

// Starting the app with the computer. Only the Windows app has it.
export type Autostart = { isEnabled(): Promise<boolean>; set(enabled: boolean): Promise<void> };

// What a shell gives the screens. `apps/windows` fills it with Tauri calls and `apps/web` with browser features.
// `openLink` opens a link from a reply outside the app's own window.
export type Platform = AppEnvironment & { kind: "windows" | "web"; openLink(url: string): void; notifications?: PageNotifications; autostart?: Autostart };

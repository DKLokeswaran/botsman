import type { AppEnvironment } from "@botsman/client-core";

// What a shell gives the screens. `apps/windows` fills it with Tauri calls and `apps/web` with browser features.
export type Platform = AppEnvironment & { kind: "windows" | "web" };

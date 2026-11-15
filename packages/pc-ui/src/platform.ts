import type { Fetch } from "@botsman/client-core";

// What a shell gives the screens. `apps/windows` fills it with Tauri calls and `apps/web` with browser features.
export type Platform = {
  kind: "windows" | "web";
  fetch: Fetch;
  // The server this shell was loaded from. The dashboard has one, and the Windows app asks the owner.
  homeServer: string | undefined;
};

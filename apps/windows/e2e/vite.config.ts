import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig, type UserConfig } from "vite";
import base from "../vite.config";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "..");
const fakeOrigin = "http://127.0.0.1:18719";

function shim(file: string): string {
  return path.join(here, "shims", file);
}

const aliases = [
  { find: /^@tauri-apps\/api\/core$/, replacement: shim("core.ts") },
  { find: /^@tauri-apps\/api\/event$/, replacement: shim("event.ts") },
  { find: /^@tauri-apps\/api\/window$/, replacement: shim("window.ts") },
  { find: /^@tauri-apps\/plugin-autostart$/, replacement: shim("autostart.ts") },
  { find: /^@tauri-apps\/plugin-http$/, replacement: shim("http.ts") },
  { find: /^@tauri-apps\/plugin-notification$/, replacement: shim("notification.ts") },
  { find: /^@tauri-apps\/plugin-websocket$/, replacement: shim("websocket.ts") },
];

/**
 * Test-only Vite config. `vite build --mode e2e` aliases Tauri to the shims in
 * this folder. The app's own vite.config.ts is what the installer build uses,
 * and it has no alias.
 */
export default defineConfig((env) => {
  const extra: UserConfig = {
    root: appRoot,
    build: {
      outDir: path.join(appRoot, "e2e", "dist"),
      emptyOutDir: true,
    },
    preview: {
      host: "127.0.0.1",
      port: 4173,
      strictPort: true,
      proxy: {
        "/auth": { target: fakeOrigin, changeOrigin: true },
        "/api": { target: fakeOrigin, changeOrigin: true, ws: true },
      },
    },
  };
  if (env.mode === "e2e") {
    extra.resolve = { alias: aliases };
  }
  return mergeConfig(base, extra);
});

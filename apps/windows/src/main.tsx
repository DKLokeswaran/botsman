import { App, indexedDbCache, type Platform } from "@botsman/pc-ui";
import "@botsman/pc-ui/styles.css";
import { getName } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { fetch as rustFetch } from "@tauri-apps/plugin-http";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { autostart, backgroundAlerts } from "./background-alerts.ts";
import { savedServer } from "./saved-server.ts";
import { tokenStore } from "./token-store.ts";
import { updater } from "./updater.ts";

// Requests leave from Rust, so the server needs no CORS rules for the app's own origin. The name is the product name
// in tauri.conf.json, which a preview build changes to Botsman Preview.
const platformNamed = (appName: string): Platform => ({
  kind: "windows",
  appName,
  fetch: (url, init) => rustFetch(url, init),
  createSocket: (url) => new WebSocket(url),
  deviceName: "Windows app",
  openLink: (url) => void invoke("open_link", { url }),
  tokenStore,
  savedServer,
  updater,
  backgroundAlerts,
  autostart,
  cache: indexedDbCache(),
});

void getName().then((appName) =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App platform={platformNamed(appName)} />
    </StrictMode>,
  ),
);

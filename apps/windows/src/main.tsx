import { App, type Platform } from "@botsman/pc-ui";
import "@botsman/pc-ui/styles.css";
import { fetch as rustFetch } from "@tauri-apps/plugin-http";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { savedServer } from "./saved-server.ts";
import { tokenStore } from "./token-store.ts";

// Requests leave from Rust, so the server needs no CORS rules for the app's own origin.
const platform: Platform = {
  kind: "windows",
  fetch: (url, init) => rustFetch(url, init),
  createSocket: (url) => new WebSocket(url),
  deviceName: "Windows app",
  tokenStore,
  savedServer,
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App platform={platform} />
  </StrictMode>,
);

import { App, type Platform } from "@botsman/pc-ui";
import "@botsman/pc-ui/styles.css";
import { fetch as rustFetch } from "@tauri-apps/plugin-http";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Requests leave from Rust, so the server needs no CORS rules for the app's own origin.
const platform: Platform = {
  kind: "windows",
  fetch: (url, init) => rustFetch(url, init),
  homeServer: undefined,
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App platform={platform} />
  </StrictMode>,
);

import { App, indexedDbCache, browserNotifications, type Platform } from "@botsman/pc-ui";
import "@botsman/pc-ui/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// The dashboard talks to the server that served it, and its session lives in cookies the page can't read.
const platform: Platform = {
  kind: "web",
  appName: "Botsman",
  fetch: (url, init) => fetch(url, init),
  createSocket: (url) => new WebSocket(url),
  deviceName: "Web dashboard",
  fixedServer: window.location.origin,
  openLink: (url) => void window.open(url, "_blank", "noopener,noreferrer"),
  notifications: browserNotifications,
  cache: indexedDbCache(),
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App platform={platform} />
  </StrictMode>,
);

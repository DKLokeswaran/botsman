import { App, type Platform } from "@botsman/pc-ui";
import "@botsman/pc-ui/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// The dashboard talks to the server that served it.
const platform: Platform = {
  kind: "web",
  fetch: (url, init) => fetch(url, init),
  homeServer: window.location.origin,
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App platform={platform} />
  </StrictMode>,
);

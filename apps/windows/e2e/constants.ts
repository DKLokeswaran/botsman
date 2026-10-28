/** Loopback origins for the browser suite. The page talks to the preview server. */
export const APP_ORIGIN = "http://127.0.0.1:4173";

/** The fake Hermes process. Node helpers call it directly. The page does not. */
export const FAKE_ORIGIN = "http://127.0.0.1:18719";

export const SHIM_MARKER = "hermes-e2e-shim";

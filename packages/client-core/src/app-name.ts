import type { Health } from "@botsman/protocol";

// The names the apps show. A preview build, and the dashboard of a preview server, show the preview name.
export const APP_NAME = "Botsman";
export const PREVIEW_APP_NAME = "Botsman Preview";

// The web dashboard has no build of its own to name it, so it takes the name of the server that served it.
export function dashboardName(health: Health): string {
  return health.preview === true ? PREVIEW_APP_NAME : APP_NAME;
}

import { createContext, useContext } from "react";

// How the shell opens a link from a reply: the default browser on Windows, a new tab on the dashboard.
export const OpenLinkContext = createContext<(url: string) => void>(() => undefined);

export function useOpenLink(): (url: string) => void {
  return useContext(OpenLinkContext);
}

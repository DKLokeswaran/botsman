import type { AppController } from "@botsman/client-core";
import { createContext, useContext } from "react";

// The controller that took the app from launch to signed in, for screens that sign out or change server.
export const AppContext = createContext<AppController | undefined>(undefined);

export function useAppController(): AppController {
  const app = useContext(AppContext);
  if (app === undefined) throw new Error("useAppController needs an AppContext above it");
  return app;
}

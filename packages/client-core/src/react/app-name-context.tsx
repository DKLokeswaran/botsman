import { createContext, type ReactNode, useContext } from "react";
import { APP_NAME } from "../app-name.ts";
import type { AppController } from "../app-controller.ts";
import { useStore } from "./use-server-state.ts";

const AppNameContext = createContext(APP_NAME);

// Gives the screens below it the name the app shows.
export function AppNameProvider({ app, children }: { app: AppController; children: ReactNode }) {
  return <AppNameContext.Provider value={useStore(app.appName)}>{children}</AppNameContext.Provider>;
}

export function useAppName(): string {
  return useContext(AppNameContext);
}

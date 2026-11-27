import { useEffect, useState } from "react";
import { AppController, type AppEnvironment, type AppState } from "../app-controller.ts";
import { useStore } from "./use-server-state.ts";

// Starts the app for one platform and reports which screen it is on.
export function useApp(environment: AppEnvironment): { app: AppController; state: AppState } {
  const [app] = useState(() => new AppController(environment));
  useEffect(() => void app.start(), [app]);
  return { app, state: useStore(app.state) };
}

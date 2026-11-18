import type { AppController, AppState } from "@botsman/client-core";
import { AppNameProvider, BotsmanProvider, useApp, useAppName } from "@botsman/client-core/react";
import { useEffect } from "react";
import { OpenLinkContext } from "./open-link.tsx";
import type { Platform } from "./platform.ts";
import { useThemeMode } from "./use-theme-mode.ts";
import { AddProviderScreen } from "./screens/add-provider.tsx";
import { ChooseServerScreen } from "./screens/choose-server.tsx";
import { SetUpScreen } from "./screens/set-up.tsx";
import { Shell } from "./screens/shell.tsx";
import { SignInScreen } from "./screens/sign-in.tsx";
import { UpdateNeededScreen } from "./screens/update-needed.tsx";

// The root of the Windows app and the web dashboard. It gives every screen the app's name and shows the screen for
// the step the app is on.
export function App({ platform }: { platform: Platform }) {
  const { app, state } = useApp(platform);
  return (
    <AppNameProvider app={app}>
      <CurrentStep app={app} state={state} platform={platform} />
    </AppNameProvider>
  );
}

function CurrentStep({ app, state, platform }: { app: AppController; state: AppState; platform: Platform }) {
  const theme = useThemeMode();
  const appName = useAppName();
  // The page title names the app, so a preview's window or browser tab says Botsman Preview.
  useEffect(() => void (document.title = appName), [appName]);
  if (state.step === "starting") return <p className="p-6 text-muted-foreground">Connecting…</p>;
  if (state.step === "choose_server") return <ChooseServerScreen key={state.error} app={app} address={state.address} error={state.error} />;
  if (state.step === "update_app" || state.step === "update_server") return <UpdateNeededScreen app={app} side={state.step} address={state.client.baseUrl} />;
  if (state.step === "set_up") return <SetUpScreen client={state.client} />;
  if (state.step === "sign_in") return <SignInScreen app={app} client={state.client} />;
  if (state.step === "add_provider")
    return (
      <BotsmanProvider client={state.client}>
        <AddProviderScreen app={app} />
      </BotsmanProvider>
    );
  return (
    <BotsmanProvider client={state.client}>
      <OpenLinkContext.Provider value={platform.openLink}>
        <Shell app={app} client={state.client} notifications={platform.notifications} autostart={platform.autostart} theme={theme} />
      </OpenLinkContext.Provider>
    </BotsmanProvider>
  );
}

import { BotsmanProvider, useApp } from "@botsman/client-core/react";
import type { Platform } from "./platform.ts";
import { useThemeMode } from "./use-theme-mode.ts";
import { ChooseServerScreen } from "./screens/choose-server.tsx";
import { SetUpScreen } from "./screens/set-up.tsx";
import { Shell } from "./screens/shell.tsx";
import { SignInScreen } from "./screens/sign-in.tsx";
import { UpdateNeededScreen } from "./screens/update-needed.tsx";

// The root of the Windows app and the web dashboard. It shows the screen for the step the app is on.
export function App({ platform }: { platform: Platform }) {
  const { app, state } = useApp(platform);
  const theme = useThemeMode();
  if (state.step === "starting") return <p className="p-6 text-muted-foreground">Connecting…</p>;
  if (state.step === "choose_server") return <ChooseServerScreen key={state.error} app={app} address={state.address} error={state.error} />;
  if (state.step === "update_app" || state.step === "update_server") return <UpdateNeededScreen app={app} side={state.step} address={state.client.baseUrl} />;
  if (state.step === "set_up") return <SetUpScreen client={state.client} />;
  if (state.step === "sign_in") return <SignInScreen app={app} client={state.client} />;
  return (
    <BotsmanProvider client={state.client}>
      <Shell app={app} client={state.client} notifications={platform.notifications} autostart={platform.autostart} theme={theme} />
    </BotsmanProvider>
  );
}

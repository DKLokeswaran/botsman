import { BotsmanProvider, useApp } from "@botsman/client-core/react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppContext } from "../src/app-context";
import { environment } from "../src/environment";
import { ChooseServerScreen } from "../src/screens/choose-server";
import { SetUpScreen } from "../src/screens/set-up";
import { SignInScreen } from "../src/screens/sign-in";
import { UpdateDialog } from "../src/ui/update-dialog";
import { UpdateNeededScreen } from "../src/screens/update-needed";
import { fontFamilies, useTheme } from "../src/theme";
import { ThemeModeProvider } from "../src/theme-mode-provider";

// The root of the Android app. It shows the screen for the step the app is on, and the main screens once signed in.
export default function RootLayout() {
  return (
    <ThemeModeProvider>
      <Themed />
    </ThemeModeProvider>
  );
}

function Themed() {
  const theme = useTheme();
  return (
    <KeyboardProvider>
      <SafeAreaProvider>
        <StatusBar style={theme.dark ? "light" : "dark"} />
        <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
          <CurrentStep />
        </View>
      </SafeAreaProvider>
    </KeyboardProvider>
  );
}

function CurrentStep() {
  const { colors } = useTheme();
  const { app, state } = useApp(environment);
  if (state.step === "starting") return <Text style={[styles.starting, { color: colors.mutedForeground }]}>Connecting…</Text>;
  if (state.step === "choose_server") return <ChooseServerScreen key={state.error} app={app} address={state.address} error={state.error} />;
  if (state.step === "update_app" || state.step === "update_server") return <UpdateNeededScreen app={app} side={state.step} address={state.client.baseUrl} />;
  if (state.step === "set_up") return <SetUpScreen client={state.client} />;
  if (state.step === "sign_in") return <SignInScreen app={app} client={state.client} />;
  return (
    <BotsmanProvider client={state.client}>
      <AppContext.Provider value={app}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
        <UpdateDialog updates={app.updates} />
      </AppContext.Provider>
    </BotsmanProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  starting: { flex: 1, textAlign: "center", textAlignVertical: "center", fontFamily: fontFamilies.body, fontSize: 14 },
});

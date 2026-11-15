import { palettes } from "@botsman/tokens";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { KeyboardProvider } from "react-native-keyboard-controller";

// The root of the Android app.
export default function RootLayout() {
  return (
    <KeyboardProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palettes.dark.background } }} />
    </KeyboardProvider>
  );
}

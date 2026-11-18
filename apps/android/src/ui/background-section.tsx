import { type BackgroundAlerts, backgroundLine, backgroundSteps, makerGuide } from "@botsman/client-core";
import { useBackgroundStatus } from "@botsman/client-core/react";
import * as Linking from "expo-linking";
import { AppState, StyleSheet, Text, View } from "react-native";
import { phoneSettings } from "../background-alerts";
import { useTheme } from "../theme";
import { Button } from "./button";
import { Note, pageStyles, SectionTitle, ToggleRow } from "./page";

// The background connection: whether it runs, and the phone settings that keep it alive.
export function BackgroundSection({ appName, background }: { appName: string; background: BackgroundAlerts }) {
  const { enabled, status } = useBackgroundStatus(background, onReturnToApp);
  return (
    <>
      <SectionTitle>Alerts when the app is closed</SectionTitle>
      <ToggleRow title="Keep connected" detail={`${appName} keeps its own connection to your server and posts alerts itself.`} on={enabled} onChange={(on) => void background.setKeepConnected(on)} />
      {status === undefined ? null : <Note>{backgroundLine(status, enabled)}</Note>}
      {status === undefined || !enabled ? null : backgroundSteps(appName, status).map((step) => <StepRow key={step.label} step={step} maker={status.maker} />)}
    </>
  );
}

function StepRow({ step, maker }: { step: ReturnType<typeof backgroundSteps>[number]; maker: string | null }) {
  const { colors } = useTheme();
  const act = { notifications: phoneSettings.notifications, battery: phoneSettings.battery, guide: () => void Linking.openURL(makerGuide(maker)) };
  return (
    <View style={[pageStyles.row, { borderColor: colors.border }]}>
      <View style={styles.grow}>
        <Text style={[pageStyles.rowTitle, { color: colors.foreground }]}>{step.label}</Text>
        <Text style={[pageStyles.small, { color: colors.mutedForeground }]}>{step.detail}</Text>
      </View>
      {step.action === undefined ? <Text style={[pageStyles.small, { color: colors.primary }]}>Done</Text> : <Button label={step.action === "guide" ? "Guide" : "Open"} variant="ghost" onPress={act[step.action]} />}
    </View>
  );
}

// Reads the status again when the owner comes back from the phone's settings.
function onReturnToApp(read: () => void): () => void {
  const subscription = AppState.addEventListener("change", (state) => state === "active" && read());
  return () => subscription.remove();
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
});

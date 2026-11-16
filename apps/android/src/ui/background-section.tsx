import { type BackgroundAlerts, type BackgroundStatus, backgroundLine, backgroundSteps, makerGuide } from "@botsman/client-core";
import { useStore } from "@botsman/client-core/react";
import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import { phoneSettings } from "../background-alerts";
import { useTheme } from "../theme";
import { Button } from "./button";
import { Note, pageStyles, SectionTitle, ToggleRow } from "./page";

// The background connection: whether it runs, and the phone settings that keep it alive.
export function BackgroundSection({ background }: { background: BackgroundAlerts }) {
  const enabled = useStore(background.enabled) ?? true;
  const status = useBackgroundStatus(background, enabled);
  return (
    <>
      <SectionTitle>Alerts when the app is closed</SectionTitle>
      <ToggleRow title="Keep connected" detail="Botsman keeps its own connection to your server and posts alerts itself." on={enabled} onChange={(on) => void background.setKeepConnected(on)} />
      {status === undefined ? null : <Note>{backgroundLine(status, enabled)}</Note>}
      {status === undefined || !enabled ? null : backgroundSteps(status).map((step) => <StepRow key={step.label} step={step} maker={status.maker} />)}
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

// The connection's status, read again when the owner comes back from the phone's settings and every few seconds.
function useBackgroundStatus(background: BackgroundAlerts, enabled: boolean): BackgroundStatus | undefined {
  const [status, setStatus] = useState<BackgroundStatus>();
  useEffect(() => {
    const read = () => void background.status().then(setStatus);
    read();
    const timer = setInterval(read, 3_000);
    const subscription = AppState.addEventListener("change", (state) => state === "active" && read());
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [background, enabled]);
  return status;
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
});

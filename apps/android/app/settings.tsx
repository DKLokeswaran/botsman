import { ALERT_CHOICES, THEME_MODES, deviceDetail } from "@botsman/client-core";
import { useAlertSettings, useBotsmanClient, useDevices } from "@botsman/client-core/react";
import type { DeviceSession } from "@botsman/protocol";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useAppController } from "../src/app-context";
import { space, useTheme, useThemeMode } from "../src/theme";
import { Button } from "../src/ui/button";
import { ErrorText, LinkRow, Note, Page, pageStyles, SectionTitle, Segmented, ToggleRow } from "../src/ui/page";
import { BackgroundSection } from "../src/ui/background-section";
import { AppVersion } from "../src/ui/app-version";
import { ServerVersion } from "../src/ui/server-version";

// Alerts, signed-in devices, providers, the theme, the server's and the app's versions, and the server this app uses.
export default function SettingsScreen() {
  const app = useAppController();
  const client = useBotsmanClient();
  const { alertSettings, save } = useAlertSettings();
  const themeMode = useThemeMode();
  return (
    <Page title="Settings" subtitle={new URL(client.baseUrl).host}>
      <SectionTitle>Alerts</SectionTitle>
      <Note>These apply to every device signed in to this server.</Note>
      {alertSettings === undefined ? <Note>This server doesn't keep alert settings yet.</Note> : null}
      {alertSettings === undefined
        ? null
        : ALERT_CHOICES.map((choice) => <ToggleRow key={choice.kind} title={choice.label} detail={choice.detail} on={alertSettings[choice.kind]} onChange={(on) => void save.run(choice.kind, on)} />)}
      <ErrorText>{save.error}</ErrorText>
      {app.background === undefined ? null : <BackgroundSection background={app.background} />}
      <LinkRow title="Model providers" detail="Keys and sign-ins for the models your bots use" onPress={() => router.push("/providers")} />
      <Devices />
      <SectionTitle>Mode</SectionTitle>
      <Segmented label="Mode" options={THEME_MODES.map((option) => ({ value: option.mode, label: option.label }))} value={themeMode[0]} onChange={themeMode[1]} />
      <SectionTitle>Server</SectionTitle>
      <ServerVersion app={app} />
      <SectionTitle>This app</SectionTitle>
      <AppVersion updates={app.updates} />
      <View style={styles.row}>
        <Button label="Sign out" onPress={() => void client.session.signOut()} />
        <Button label="Change server" onPress={() => void app.changeServer()} />
      </View>
    </Page>
  );
}

function Devices() {
  const { devices, error, revoke } = useDevices();
  return (
    <>
      <SectionTitle>Signed-in devices</SectionTitle>
      <ErrorText>{error}</ErrorText>
      {devices === undefined ? <Note>Loading…</Note> : null}
      {(devices ?? []).map((session) => (
        <DeviceRow key={session.id} session={session} busy={revoke.busy} onRevoke={() => void revoke.run(session.id)} />
      ))}
    </>
  );
}

function DeviceRow({ session, busy, onRevoke }: { session: DeviceSession; busy: boolean; onRevoke: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[pageStyles.row, { borderColor: colors.border }]}>
      <View style={styles.grow}>
        <Text style={[pageStyles.rowTitle, { color: colors.foreground }]}>{session.deviceName}</Text>
        <Text style={[pageStyles.small, { color: colors.mutedForeground }]}>{deviceDetail(session)}</Text>
      </View>
      {session.current ? null : <Button label="Sign out" variant="danger" disabled={busy} onPress={onRevoke} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space[2] },
  grow: { flex: 1 },
});

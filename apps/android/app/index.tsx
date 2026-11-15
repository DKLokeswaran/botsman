import { useServerHealth, type ServerHealthState } from "@botsman/client-core/react";
import { chatStream } from "@botsman/protocol";
import { fonts, palettes, radius, space } from "@botsman/tokens";
import { LegendList } from "@legendapp/list/react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { EnrichedMarkdownText } from "react-native-enriched-markdown";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { BotsmanAlerts } from "../modules/botsman-alerts";

const colors = palettes.dark;

type Row = { label: string; value: string };

const SAMPLE_MARKDOWN = "A reply with **bold**, `code`, and a list:\n\n- first\n- second\n\n```ts\nconst answer = 42;\n```";

// Asks for a server address and shows whether a Botsman server answers there.
export default function ServerCheckScreen() {
  const [address, setAddress] = useState("");
  const { state, check } = useServerHealth(fetch);

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior="padding" style={styles.body}>
        <Text style={styles.title}>BOTSMAN</Text>
        <LegendList data={rowsOf(state)} keyExtractor={(row) => row.label} renderItem={({ item }) => <RowView row={item} />} style={styles.list} />
        <EnrichedMarkdownText markdown={SAMPLE_MARKDOWN} />
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="bots.example.com"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            accessibilityLabel="Server address"
          />
          <Pressable style={styles.button} onPress={() => void check(address)} disabled={state.status === "checking"} accessibilityRole="button">
            <Text style={styles.buttonText}>Check</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function RowView({ row }: { row: Row }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{row.label}</Text>
      <Text style={styles.rowValue}>{row.value}</Text>
    </View>
  );
}

// The lines the list shows: the device, a protocol value, and the server's answer.
function rowsOf(state: ServerHealthState): Row[] {
  const fixed: Row[] = [
    { label: "Device", value: BotsmanAlerts.deviceSummary() },
    { label: "Protocol", value: chatStream("main") },
  ];
  if (state.status === "idle") return fixed;
  if (state.status === "checking") return [...fixed, { label: "Server", value: "Checking…" }];
  if (state.status === "failed") return [...fixed, { label: "Server", value: state.message }];
  return [
    ...fixed,
    { label: "Server", value: state.baseUrl },
    { label: "Version", value: state.health.version },
    { label: "Sandboxes", value: state.health.sandbox.ok ? "Working" : (state.health.sandbox.reason ?? "Not working") },
  ];
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, padding: space[4], gap: space[4] },
  title: { color: colors.foreground, fontFamily: fonts.display, fontSize: 30, fontWeight: "900", letterSpacing: 0.3 },
  list: { flex: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: space[4], paddingVertical: space[2], borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { color: colors.mutedForeground, fontSize: 14 },
  rowValue: { color: colors.green, fontSize: 14, flexShrink: 1, textAlign: "right" },
  form: { flexDirection: "row", gap: space[2] },
  input: { flex: 1, color: colors.foreground, borderWidth: 1, borderColor: colors.input, borderRadius: radius.md, paddingHorizontal: space[3], paddingVertical: space[2], fontSize: 14 },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: space[4], justifyContent: "center" },
  buttonText: { color: colors.primaryForeground, fontWeight: "600" },
});

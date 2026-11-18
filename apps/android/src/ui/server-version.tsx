import { type AppController, SERVER_UPDATE_COMMAND, serverUpdate, serverUpdateText, serverVersionLine } from "@botsman/client-core";
import { useStore } from "@botsman/client-core/react";
import { StyleSheet, Text, View } from "react-native";
import { fontFamilies, radius, space, useTheme } from "../theme";
import { pageStyles } from "./page";

// The connected server's version, and how to update it when a newer release exists.
export function ServerVersion({ app }: { app: AppController }) {
  const { colors } = useTheme();
  const health = useStore(app.serverHealth);
  if (health === undefined) return null;
  const update = serverUpdate(health);
  return (
    <View style={styles.group}>
      <View style={[pageStyles.row, { borderColor: colors.border }]}>
        <Text style={[pageStyles.small, { color: colors.foreground }]}>{serverVersionLine(health)}</Text>
      </View>
      {update === undefined ? null : <ServerUpdateSteps version={update} />}
    </View>
  );
}

// The command that updates the server, which the owner runs on the server itself.
export function ServerUpdateSteps({ version }: { version: string | undefined }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="alert" style={[styles.notice, { borderColor: colors.primary }]}>
      <Text style={[styles.text, { color: colors.foreground }]}>{serverUpdateText(version)}</Text>
      <Text selectable style={[styles.command, { color: colors.foreground, backgroundColor: colors.muted }]}>
        {SERVER_UPDATE_COMMAND}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space[2] },
  notice: { borderWidth: 1, borderRadius: radius.md, padding: space[3], gap: space[2] },
  text: { fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 21 },
  command: { fontFamily: fontFamilies.mono, fontSize: 14, borderRadius: radius.md, paddingHorizontal: space[2], paddingVertical: space[1] },
});

import type { UpdateChecker } from "@botsman/client-core";
import { useAppVersion } from "@botsman/client-core/react";
import { StyleSheet, Text, View } from "react-native";
import { space, useTheme } from "../theme";
import { Button } from "./button";
import { pageStyles } from "./page";
import { UpdateNotice } from "./update-notice";

// This app's version, whether it is up to date, and a way to check now.
export function AppVersion({ updates }: { updates: UpdateChecker | undefined }) {
  const { colors } = useTheme();
  const { line, canCheck } = useAppVersion(updates);
  if (updates === undefined) return null;
  return (
    <View style={styles.group}>
      <View style={[pageStyles.row, { borderColor: colors.border }]}>
        <Text style={[pageStyles.small, styles.grow, { color: colors.foreground }]}>{line}</Text>
        <Button label="Check" disabled={!canCheck} onPress={() => void updates.checkNow()} />
      </View>
      <UpdateNotice updates={updates} />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space[2] },
  grow: { flex: 1 },
});

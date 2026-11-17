import { type UpdateChecker, versionLine } from "@botsman/client-core";
import { useUpdateInfo, useUpdateState } from "@botsman/client-core/react";
import { StyleSheet, Text, View } from "react-native";
import { space, useTheme } from "../theme";
import { Button } from "./button";
import { pageStyles } from "./page";
import { UpdateNotice } from "./update-notice";

// This app's version, whether it is up to date, and a way to check now.
export function AppVersion({ updates }: { updates: UpdateChecker | undefined }) {
  const { colors } = useTheme();
  const info = useUpdateInfo(updates);
  const state = useUpdateState(updates);
  if (updates === undefined) return null;
  return (
    <View style={styles.group}>
      <View style={[pageStyles.row, { borderColor: colors.border }]}>
        <Text style={[pageStyles.small, styles.grow, { color: colors.foreground }]}>{versionLine(info, state)}</Text>
        <Button label="Check" disabled={info.checking || state.status === "installing"} onPress={() => void updates.checkNow()} />
      </View>
      <UpdateNotice updates={updates} />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space[2] },
  grow: { flex: 1 },
});

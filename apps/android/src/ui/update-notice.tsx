import type { UpdateChecker } from "@botsman/client-core";
import { useUpdateNotice } from "@botsman/client-core/react";
import { StyleSheet, Text, View } from "react-native";
import { fontFamilies, radius, space, useTheme } from "../theme";
import { Button } from "./button";

// Says when a newer build of the app is ready, and installs it on request. It shows nothing when the app is current.
export function UpdateNotice({ updates }: { updates: UpdateChecker | undefined }) {
  const { colors } = useTheme();
  const notice = useUpdateNotice(updates);
  if (updates === undefined || notice === undefined) return null;
  return (
    <View accessibilityRole="alert" style={[styles.notice, { borderColor: colors.primary }]}>
      <Text style={[styles.text, { color: colors.foreground }]}>{notice.notice}</Text>
      {notice.error === undefined ? null : <Text style={[styles.text, { color: colors.destructive }]}>{notice.error}</Text>}
      {notice.install === undefined ? null : <Button label={notice.install} variant="primary" onPress={() => void updates.install()} />}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { borderWidth: 1, borderRadius: radius.md, padding: space[3], gap: space[2] },
  text: { fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 21 },
});

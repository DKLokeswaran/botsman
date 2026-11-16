import type { UpdateChecker } from "@botsman/client-core";
import { useUpdateState } from "@botsman/client-core/react";
import { StyleSheet, Text, View } from "react-native";
import { fontFamilies, radius, space, useTheme } from "../theme";
import { Button } from "./button";

// Says when a newer build of the app is ready, and installs it on request. It shows nothing when the app is current.
export function UpdateNotice({ updates }: { updates: UpdateChecker | undefined }) {
  const { colors } = useTheme();
  const state = useUpdateState(updates);
  if (updates === undefined || state.status === "none") return null;
  return (
    <View accessibilityRole="alert" style={[styles.notice, { borderColor: colors.primary }]}>
      <Text style={[styles.text, { color: colors.foreground }]}>{state.status === "installing" ? `Installing ${state.version}…` : `Version ${state.version} is ready to install.`}</Text>
      {state.status === "failed" ? <Text style={[styles.text, { color: colors.destructive }]}>{state.error}</Text> : null}
      {state.status === "installing" ? null : <Button label={state.status === "failed" ? "Try again" : "Install"} variant="primary" onPress={() => void updates.install()} />}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { borderWidth: 1, borderRadius: radius.md, padding: space[3], gap: space[2] },
  text: { fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 21 },
});

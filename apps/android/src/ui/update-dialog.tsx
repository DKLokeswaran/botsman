import { asksToUpdate, type UpdateChecker } from "@botsman/client-core";
import { useDeclinedUpdate, useUpdateInfo, useUpdateState } from "@botsman/client-core/react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { fontFamilies, radius, space, useTheme } from "../theme";
import { Button } from "./button";

// "Update available": asks once per new version, with Not now and Install. Settings keeps Install for later.
export function UpdateDialog({ updates }: { updates: UpdateChecker | undefined }) {
  const { colors } = useTheme();
  const state = useUpdateState(updates);
  const declined = useDeclinedUpdate(updates);
  const info = useUpdateInfo(updates);
  if (updates === undefined || state.status === "none" || !asksToUpdate(state, declined)) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => updates.notNow()}>
      <View style={styles.backdrop}>
        <View accessibilityRole="alert" style={[styles.dialog, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>{state.status === "installing" ? "INSTALLING" : "UPDATE AVAILABLE"}</Text>
          <Text style={[styles.body, { color: colors.foreground }]}>
            {state.status === "installing" ? `Installing ${state.version}. Android asks you to confirm.` : `Version ${state.version} is ready to install.${info.installed === undefined ? "" : ` You're on ${info.installed}.`}`}
          </Text>
          {state.status === "failed" ? <Text style={[styles.body, { color: colors.destructive }]}>{state.error}</Text> : null}
          {state.status === "installing" ? null : (
            <View style={styles.buttons}>
              <Button label="Not now" onPress={() => updates.notNow()} />
              <Button label={state.status === "failed" ? "Try again" : "Install"} variant="primary" onPress={() => void updates.install()} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: space[4] },
  dialog: { width: "100%", maxWidth: 380, borderWidth: 1, borderRadius: radius.lg, padding: space[5], gap: space[3] },
  title: { fontFamily: fontFamilies.display, fontSize: 15 },
  body: { fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 22 },
  buttons: { flexDirection: "row", justifyContent: "flex-end", gap: space[2] },
});

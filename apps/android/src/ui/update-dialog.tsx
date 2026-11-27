import type { UpdateChecker } from "@botsman/client-core";
import { useUpdateDialog } from "@botsman/client-core/react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { fontFamilies, radius, space, useTheme } from "../theme";
import { Button } from "./button";

const INSTALLING_NOTE = "Android asks you to confirm.";

// "Update available": asks once per new version, with Not now and Install. Settings keeps Install for later.
export function UpdateDialog({ updates }: { updates: UpdateChecker | undefined }) {
  const { colors } = useTheme();
  const dialog = useUpdateDialog(updates, INSTALLING_NOTE);
  if (updates === undefined || dialog === undefined) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => updates.notNow()}>
      <View style={styles.backdrop}>
        <View accessibilityRole="alert" style={[styles.dialog, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>{dialog.title.toUpperCase()}</Text>
          <Text style={[styles.body, { color: colors.foreground }]}>
            {dialog.message}
          </Text>
          {dialog.error === undefined ? null : <Text style={[styles.body, { color: colors.destructive }]}>{dialog.error}</Text>}
          {dialog.install === undefined ? null : (
            <View style={styles.buttons}>
              <Button label="Not now" onPress={() => updates.notNow()} />
              <Button label={dialog.install} variant="primary" onPress={() => void updates.install()} />
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

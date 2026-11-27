import type { Bot, ChatController, ChatSettings } from "@botsman/client-core";
import { useModelPicker } from "@botsman/client-core/react";
import { router } from "expo-router";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fontFamilies, radius, space, useTheme } from "../theme";
import { ErrorText, Note, Segmented } from "./page";

// The model and reasoning picker, as a sheet from the bottom of the screen. Without a chat, such as from bot info, it
// changes only the bot's default.
export function ModelSheet({ visible, bot, chat, onClose }: { visible: boolean; bot: Bot; chat?: { controller: ChatController; settings: ChatSettings }; onClose: () => void }) {
  const { colors } = useTheme();
  const picker = useModelPicker(bot, chat);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={onClose} />
      <SafeAreaView edges={["bottom"]} style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.body}>
          {picker.scopes === undefined ? null : <Segmented label="Applies to" options={picker.scopes} value={picker.scope} onChange={picker.setScope} />}
          <Note>{picker.note}</Note>
          <Text style={[styles.label, { color: colors.foreground }]}>Model</Text>
          {picker.loading ? <Note>Loading…</Note> : null}
          <ScrollView style={styles.models} nestedScrollEnabled>
            {picker.models.map((model) => (
              <Pressable key={model.key} accessibilityRole="radio" accessibilityState={{ checked: model.chosen }} onPress={() => picker.pickModel(model.ref)} style={styles.option}>
                <Text style={[styles.optionText, { color: model.chosen ? colors.primary : colors.foreground }]}>
                  {model.chosen ? "● " : "○ "}
                  {model.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={[styles.label, { color: colors.foreground }]}>Reasoning effort</Text>
          <EffortChips efforts={picker.efforts} onPick={picker.pickEffort} />
          <ErrorText>{picker.error}</ErrorText>
          <Pressable accessibilityRole="button" onPress={() => (onClose(), router.push("/providers"))} hitSlop={8} style={styles.footer}>
            <Text style={[styles.optionText, { color: colors.primary }]}>Connect a provider</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

type Picker = ReturnType<typeof useModelPicker>;

// The reasoning efforts the model offers, with the one in use marked.
function EffortChips({ efforts, onPick }: { efforts: Picker["efforts"]; onPick: Picker["pickEffort"] }) {
  const { colors } = useTheme();
  return (
    <View style={styles.chips}>
      {efforts.map(({ level, label, chosen }) => (
        <Pressable key={level} accessibilityRole="radio" accessibilityState={{ checked: chosen }} onPress={() => onPick(level)} style={[styles.chip, { borderColor: chosen ? colors.primary : colors.border }]}>
          <Text style={[styles.chipText, { color: chosen ? colors.primary : colors.foreground }]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { borderTopWidth: 1, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: "75%" },
  body: { padding: space[4], gap: space[3] },
  label: { fontFamily: fontFamilies.bodySemiBold, fontSize: 14 },
  models: { maxHeight: 220 },
  option: { paddingVertical: space[2] },
  optionText: { fontFamily: fontFamilies.body, fontSize: 15 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  chip: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space[3], paddingVertical: space[2] },
  chipText: { fontFamily: fontFamilies.body, fontSize: 13 },
  footer: { paddingTop: space[2] },
});

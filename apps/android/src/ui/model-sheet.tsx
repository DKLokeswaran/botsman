import { type ChatController, effortChoices, effortLabel, modelLabel, PICKER_SCOPES, type PickerScope, pickerValue, sameModel, shownEffort, type Bot, type ChatSettings, type ModelRef, type ThinkingLevel } from "@botsman/client-core";
import { useAction, useBotsmanClient, useModels } from "@botsman/client-core/react";
import { router } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fontFamilies, radius, space, useTheme } from "../theme";
import { ErrorText, Note, Segmented } from "./page";

// The model and reasoning picker, as a sheet from the bottom of the screen. Without a chat, such as from bot info, it
// changes only the bot's default.
export function ModelSheet({ visible, bot, chat, onClose }: { visible: boolean; bot: Bot; chat?: { controller: ChatController; settings: ChatSettings }; onClose: () => void }) {
  const { colors } = useTheme();
  const client = useBotsmanClient();
  const { models, loading } = useModels();
  const [scope, setScope] = useState<PickerScope>(chat === undefined ? "bot" : "chat");
  const value = pickerValue(scope, chat?.settings ?? { model: bot.defaultModel, thinkingLevel: bot.thinkingLevel }, bot);
  const save = useAction((change: { model?: ModelRef | null; thinkingLevel?: ThinkingLevel }) =>
    scope === "chat" && chat !== undefined ? chat.controller.changeSettings(change) : client.updateBot(bot.id, { defaultModel: change.model, thinkingLevel: change.thinkingLevel }),
  );
  const current = models.find((model) => sameModel(model, value.model));
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={onClose} />
      <SafeAreaView edges={["bottom"]} style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.body}>
          {chat === undefined ? null : <Segmented label="Applies to" options={PICKER_SCOPES} value={scope} onChange={setScope} />}
          <Note>{value.note}</Note>
          <Text style={[styles.label, { color: colors.foreground }]}>Model</Text>
          {loading ? <Note>Loading…</Note> : null}
          <ScrollView style={styles.models} nestedScrollEnabled>
            {models.map((model) => {
              const chosen = sameModel(model, value.model);
              return (
                <Pressable key={`${model.provider}/${model.id}`} accessibilityRole="radio" accessibilityState={{ checked: chosen }} onPress={() => void save.run({ model: { provider: model.provider, modelId: model.id } })} style={styles.option}>
                  <Text style={[styles.optionText, { color: chosen ? colors.primary : colors.foreground }]}>
                    {chosen ? "● " : "○ "}
                    {modelLabel(model)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={[styles.label, { color: colors.foreground }]}>Reasoning effort</Text>
          <View style={styles.chips}>
            {effortChoices(current).map((level) => {
              const chosen = level === shownEffort(current, value.thinkingLevel);
              return (
                <Pressable key={level} accessibilityRole="radio" accessibilityState={{ checked: chosen }} onPress={() => void save.run({ thinkingLevel: level })} style={[styles.chip, { borderColor: chosen ? colors.primary : colors.border }]}>
                  <Text style={[styles.chipText, { color: chosen ? colors.primary : colors.foreground }]}>{effortLabel(level)}</Text>
                </Pressable>
              );
            })}
          </View>
          <ErrorText>{save.error}</ErrorText>
          <Pressable accessibilityRole="button" onPress={() => (onClose(), router.push("/providers"))} hitSlop={8} style={styles.footer}>
            <Text style={[styles.optionText, { color: colors.primary }]}>Connect a provider</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
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

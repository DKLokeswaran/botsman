import { effortChoices, effortLabel, shownEffort, modelLabel, type PickerScope, pickerValue, sameModel } from "@botsman/client-core";
import { useAction, useBot, useBotsmanClient, useChat, useModels } from "@botsman/client-core/react";
import type { ModelRef, ThinkingLevel } from "@botsman/protocol";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { space, useTheme } from "../../src/theme";
import { ErrorText, LinkRow, Note, Page, pageStyles, SectionTitle, Segmented } from "../../src/ui/page";

// Picks the model and reasoning effort for the open chat, or for the bot's default.
export default function ModelScreen() {
  const { botId, scope: startScope } = useLocalSearchParams<{ botId: string; scope?: PickerScope }>();
  const client = useBotsmanClient();
  const bot = useBot(botId);
  const { chat, state } = useChat(botId);
  const { models, loading } = useModels();
  const [scope, setScope] = useState<PickerScope>(startScope === "bot" ? "bot" : "chat");
  const save = useAction((change: { model?: ModelRef | null; thinkingLevel?: ThinkingLevel }) =>
    scope === "chat" ? chat.changeSettings(change) : client.updateBot(botId, { defaultModel: change.model, thinkingLevel: change.thinkingLevel }),
  );
  if (bot === undefined) return <Page title="Model"><Note>This bot no longer exists.</Note></Page>;
  const value = pickerValue(scope, state.settings, bot);
  const current = models.find((model) => sameModel(model, value.model));
  return (
    <Page title="Model and reasoning" subtitle={bot.name}>
      <Segmented label="Applies to" options={[{ value: "chat" as const, label: "This chat" }, { value: "bot" as const, label: "Bot default" }]} value={scope} onChange={setScope} />
      <Note>{value.note}</Note>
      <SectionTitle>Model</SectionTitle>
      {loading ? <Note>Loading…</Note> : null}
      {models.map((model) => (
        <Choice key={`${model.provider}/${model.id}`} label={modelLabel(model)} chosen={sameModel(model, value.model)} onPick={() => void save.run({ model: { provider: model.provider, modelId: model.id } })} />
      ))}
      <SectionTitle>Reasoning effort</SectionTitle>
      <View style={styles.chips}>
        {effortChoices(current).map((level) => (
          <Choice key={level} label={effortLabel(level)} chosen={level === shownEffort(current, value.thinkingLevel)} onPick={() => void save.run({ thinkingLevel: level })} />
        ))}
      </View>
      <ErrorText>{save.error}</ErrorText>
      <LinkRow title="Connect a provider" detail="Add a key or sign in to get more models" onPress={() => router.push("/providers")} />
    </Page>
  );
}

function Choice({ label, chosen, onPick }: { label: string; chosen: boolean; onPick: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: chosen }} onPress={onPick} style={[pageStyles.row, { borderColor: chosen ? colors.primary : colors.border }]}>
      <Text style={[pageStyles.small, { color: chosen ? colors.primary : colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
});

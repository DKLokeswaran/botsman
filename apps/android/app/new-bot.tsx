import { modelLabel, sameModel } from "@botsman/client-core";
import { useNewBotDraft } from "@botsman/client-core/react";
import type { ModelInfo, ModelRef } from "@botsman/protocol";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { space, useTheme } from "../src/theme";
import { Button } from "../src/ui/button";
import { Field } from "../src/ui/field";
import { ErrorText, Note, Page, pageStyles } from "../src/ui/page";

// Creates a bot with its own folder, files, and chat. It starts with Manual permissions.
export default function NewBotScreen() {
  const draft = useNewBotDraft((botId) => router.replace({ pathname: "/chat/[botId]", params: { botId } }));
  const { name, setName, description, setDescription, purpose, setPurpose, folder, setFolder } = draft;
  return (
    <Page title="New bot">
      <Note>The bot gets its own folder, its own files, and its own chat. It starts with Manual permissions.</Note>
      <Field label="Name" value={name} maxLength={60} autoCapitalize="words" onChangeText={setName} />
      <Field label="Description" placeholder="Shown in the bot list" value={description} maxLength={500} autoCapitalize="sentences" onChangeText={setDescription} />
      <Field label="Purpose" placeholder="What this bot is for. Saved as BOT_PROFILE.md." value={purpose} maxLength={6000} autoCapitalize="sentences" multiline numberOfLines={6} textAlignVertical="top" onChangeText={setPurpose} />
      <ModelChoice models={draft.models} loading={draft.loading} value={draft.model} onChange={draft.setModel} />
      <Field label="Folder on the server" placeholder="~/.botsman/workspaces/<id>" value={folder} onChangeText={setFolder} hint={draft.folderHint} />
      <ErrorText>{draft.error}</ErrorText>
      <Button label="Create bot" variant="primary" disabled={!draft.ready || draft.create.busy} onPress={() => void draft.create.run()} />
    </Page>
  );
}

function ModelChoice({ models, loading, value, onChange }: { models: ModelInfo[]; loading: boolean; value: ModelRef | null; onChange: (model: ModelRef) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[pageStyles.rowTitle, { color: colors.foreground }]}>Default model</Text>
      {loading ? <Note>Loading…</Note> : null}
      {!loading && models.length === 0 ? <Note>Connect a model provider to choose a model.</Note> : null}
      {models.map((model) => {
        const chosen = sameModel(model, value);
        return (
          <Pressable key={`${model.provider}/${model.id}`} accessibilityRole="radio" accessibilityState={{ checked: chosen }} onPress={() => onChange({ provider: model.provider, modelId: model.id })} style={[pageStyles.row, { borderColor: chosen ? colors.primary : colors.border }]}>
            <Text style={[pageStyles.small, { color: chosen ? colors.primary : colors.foreground }]}>{modelLabel(model)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space[2] },
});

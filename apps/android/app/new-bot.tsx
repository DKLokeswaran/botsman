import { useNewBotDraft } from "@botsman/client-core/react";
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
      <Field label="Name" value={name} maxLength={draft.limits.name} autoCapitalize="words" onChangeText={setName} />
      <Field label="Description" placeholder="Shown in the bot list" value={description} maxLength={draft.limits.description} autoCapitalize="sentences" onChangeText={setDescription} />
      <Field label="Purpose" placeholder="What this bot is for. Saved as BOT_PROFILE.md." value={purpose} maxLength={draft.limits.purpose} autoCapitalize="sentences" multiline numberOfLines={6} textAlignVertical="top" onChangeText={setPurpose} />
      <ModelList draft={draft} />
      <Field label="Folder on the server" placeholder="~/.botsman/workspaces/<id>" value={folder} onChangeText={setFolder} hint={draft.folderHint} />
      <ErrorText>{draft.error}</ErrorText>
      <Button label="Create bot" variant="primary" disabled={!draft.ready} onPress={() => void draft.create.run()} />
    </Page>
  );
}

// The models to choose the bot's default from.
function ModelList({ draft }: { draft: ReturnType<typeof useNewBotDraft> }) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[pageStyles.rowTitle, { color: colors.foreground }]}>Default model</Text>
      {draft.loading ? <Note>Loading…</Note> : null}
      {draft.modelHint === undefined ? null : <Note>{draft.modelHint}</Note>}
      {draft.models.map((model) => (
        <Pressable key={model.key} accessibilityRole="radio" accessibilityState={{ checked: model.chosen }} onPress={() => draft.setModel(model.ref)} style={[pageStyles.row, { borderColor: model.chosen ? colors.primary : colors.border }]}>
          <Text style={[pageStyles.small, { color: model.chosen ? colors.primary : colors.foreground }]}>{model.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space[2] },
});

import { botNameProblem, formatBytes, modelLabel, sameModel, suggestedModel } from "@botsman/client-core";
import { useAction, useBots, useBotsmanClient, useFreeSpace, useModels } from "@botsman/client-core/react";
import type { FreeSpace, ModelInfo, ModelRef } from "@botsman/protocol";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { space, useTheme } from "../src/theme";
import { Button } from "../src/ui/button";
import { Field } from "../src/ui/field";
import { ErrorText, Note, Page, pageStyles } from "../src/ui/page";

// Creates a bot with its own folder, files, and chat. It starts with Manual permissions.
export default function NewBotScreen() {
  const client = useBotsmanClient();
  const main = useBots().find((bot) => bot.isMain);
  const { models, loading } = useModels();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [purpose, setPurpose] = useState("");
  const [picked, setPicked] = useState<ModelRef | null>();
  const [folder, setFolder] = useState("");
  const space = useFreeSpace(folder);
  const model = picked === undefined ? suggestedModel(models, main?.defaultModel) : picked;
  const problem = name === "" ? undefined : botNameProblem(name);
  const create = useAction(async () => {
    const bot = await client.createBot({ name: name.trim(), description: description.trim(), purpose: purpose.trim(), defaultModel: model, folder: folder.trim() });
    router.replace({ pathname: "/chat/[botId]", params: { botId: bot.id } });
  });
  const ready = name.trim() !== "" && problem === undefined && space?.allowed !== false;
  return (
    <Page title="New bot">
      <Note>The bot gets its own folder, its own files, and its own chat. It starts with Manual permissions.</Note>
      <Field label="Name" value={name} maxLength={60} autoCapitalize="words" onChangeText={setName} />
      <Field label="Description" placeholder="Shown in the bot list" value={description} maxLength={500} autoCapitalize="sentences" onChangeText={setDescription} />
      <Field label="Purpose" placeholder="What this bot is for. Saved as BOT_PROFILE.md." value={purpose} maxLength={6000} autoCapitalize="sentences" multiline numberOfLines={6} textAlignVertical="top" onChangeText={setPurpose} />
      <ModelChoice models={models} loading={loading} value={model} onChange={setPicked} />
      <Field label="Folder on the server" placeholder="~/.botsman/workspaces/<id>" value={folder} onChangeText={setFolder} hint={folderHint(space)} />
      <ErrorText>{problem ?? (space?.allowed === false ? space.reason : undefined) ?? create.error}</ErrorText>
      <Button label="Create bot" variant="primary" disabled={!ready || create.busy} onPress={() => void create.run()} />
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

function folderHint(space: FreeSpace | undefined): string {
  const free = space === undefined ? "" : ` Free space: ${formatBytes(space.freeBytes)} of ${formatBytes(space.totalBytes)}.`;
  return `Leave it empty for the default. The bot can read and write everything in this folder.${free}`;
}

const styles = StyleSheet.create({
  group: { gap: space[2] },
});

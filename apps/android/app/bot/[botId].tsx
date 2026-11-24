import { modelDefaultLabel, photoAvatar, type Avatar as AvatarValue, type Bot } from "@botsman/client-core";
import { useAction, useBot, useBotNameForm, useBotsmanClient } from "@botsman/client-core/react";
import { MARK_IDS, MARKS } from "@botsman/tokens";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { pickPhoto } from "../../src/photo";
import { radius, space, useTheme } from "../../src/theme";
import { Avatar, MarkIcon } from "../../src/ui/avatar";
import { Button } from "../../src/ui/button";
import { Field } from "../../src/ui/field";
import { ModelSheet } from "../../src/ui/model-sheet";
import { ErrorText, LinkRow, Note, Page } from "../../src/ui/page";

// A bot's name, description, and face, with links to its other screens, and delete.
export default function BotInfoScreen() {
  const { botId } = useLocalSearchParams<{ botId: string }>();
  const bot = useBot(botId);
  if (bot === undefined) return <Page title="Bot info"><Note>This bot no longer exists.</Note></Page>;
  return (
    <Page title={bot.name} subtitle="Bot info">
      <FacePicker bot={bot} />
      <NameForm key={`${bot.name}\n${bot.description}`} bot={bot} />
      <ModelDefault bot={bot} />
      <LinkRow title="Memory" detail="The four files this bot loads" onPress={() => router.push({ pathname: "/memory/[botId]", params: { botId: bot.id } })} />
      <LinkRow title="Notes" detail="Longer records this bot keeps" onPress={() => router.push({ pathname: "/notes/[botId]", params: { botId: bot.id } })} />
      <LinkRow title="Bot settings" detail="Permissions, approval wait, network" onPress={() => router.push({ pathname: "/bot-settings/[botId]", params: { botId: bot.id } })} />
      <DeleteBot bot={bot} />
    </Page>
  );
}

function FacePicker({ bot }: { bot: Bot }) {
  const { colors } = useTheme();
  const client = useBotsmanClient();
  const save = useAction((avatar: AvatarValue | null) => client.updateBot(bot.id, { avatar }));
  const upload = useAction(async () => {
    const dataUrl = await pickPhoto();
    if (dataUrl !== undefined) await client.updateBot(bot.id, { avatar: photoAvatar(dataUrl) });
  });
  return (
    <View style={styles.group}>
      <View style={styles.hero}>
        <Avatar bot={bot} size={96} />
        <View style={styles.group}>
          <Button label="Upload a photo" variant="primary" disabled={upload.busy} onPress={() => void upload.run()} />
          {bot.avatar === null ? null : <Button label="Use the initial" variant="text" onPress={() => void save.run(null)} />}
        </View>
      </View>
      <Note>Or choose</Note>
      <View style={styles.marks}>
        {MARK_IDS.map((mark) => {
          const chosen = bot.avatar?.kind === "mark" && bot.avatar.mark === mark;
          return (
            <Pressable key={mark} accessibilityRole="button" accessibilityLabel={mark} accessibilityState={{ selected: chosen }} onPress={() => void save.run({ kind: "mark", mark })} style={[styles.mark, { borderColor: chosen ? colors.primary : colors.border }]}>
              <MarkIcon paths={MARKS[mark]!} size={22} color={chosen ? colors.primary : colors.foreground} />
            </Pressable>
          );
        })}
      </View>
      <ErrorText>{save.error ?? upload.error}</ErrorText>
    </View>
  );
}

function NameForm({ bot }: { bot: Bot }) {
  const form = useBotNameForm(bot);
  return (
    <View style={styles.group}>
      <Field label="Name" value={form.name} maxLength={form.limits.name} autoCapitalize="words" onChangeText={form.setName} />
      <Field label="Description" value={form.description} maxLength={form.limits.description} autoCapitalize="sentences" onChangeText={form.setDescription} />
      <ErrorText>{form.error}</ErrorText>
      {form.changed ? <Button label="Save" variant="primary" disabled={!form.ready} onPress={form.submit} /> : null}
    </View>
  );
}

// The bot's default model and reasoning effort, which opens the picker for them.
function ModelDefault({ bot }: { bot: Bot }) {
  const [open, setOpen] = useState(false);
  const current = modelDefaultLabel(bot);
  return (
    <>
      <LinkRow title="Model default" detail={`${current} · used by chats that haven't picked their own`} onPress={() => setOpen(true)} />
      <ModelSheet visible={open} bot={bot} onClose={() => setOpen(false)} />
    </>
  );
}

function DeleteBot({ bot }: { bot: Bot }) {
  const { colors } = useTheme();
  const client = useBotsmanClient();
  const [asking, setAsking] = useState(false);
  const remove = useAction(async () => {
    await client.deleteBot(bot.id);
    router.dismissAll();
  });
  if (bot.isMain) return <Note>The main bot can't be deleted.</Note>;
  if (!asking) return <Button label="Delete bot" variant="danger" onPress={() => setAsking(true)} />;
  return (
    <View style={[styles.confirm, { borderColor: colors.destructive }]}>
      <Note>{`Delete ${bot.name}? It leaves the apps, and its data stays on the server. The main bot can restore it.`}</Note>
      <ErrorText>{remove.error}</ErrorText>
      <View style={styles.hero}>
        <Button label="Delete" variant="danger" disabled={remove.busy} onPress={() => void remove.run()} />
        <Button label="Cancel" variant="text" onPress={() => setAsking(false)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space[3] },
  hero: { flexDirection: "row", alignItems: "center", gap: space[4] },
  marks: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  mark: { width: 44, height: 44, borderWidth: 1, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  confirm: { borderWidth: 1, borderRadius: radius.md, padding: space[3], gap: space[2] },
});

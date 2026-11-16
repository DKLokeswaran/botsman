import { noteNameProblem } from "@botsman/client-core";
import { useAction, useBot, useBotsmanClient } from "@botsman/client-core/react";
import type { Note as NoteValue } from "@botsman/protocol";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { fontFamilies, radius, space, useTheme } from "../../../src/theme";
import { Button } from "../../../src/ui/button";
import { Field } from "../../../src/ui/field";
import { ErrorText, Note, Page } from "../../../src/ui/page";

// One note to read, edit, rename, or delete. A name with no file yet starts a new note.
export default function NoteScreen() {
  const { botId, name } = useLocalSearchParams<{ botId: string; name: string }>();
  const client = useBotsmanClient();
  const bot = useBot(botId);
  const [loaded, setLoaded] = useState<NoteValue | null>();
  useEffect(() => {
    client.note(botId, name).then(setLoaded, () => setLoaded(null));
  }, [client, botId, name]);
  if (bot === undefined) return <Page title="Note"><Note>This bot no longer exists.</Note></Page>;
  return (
    <Page title={name} subtitle={`${bot.name} · Notes`}>
      {loaded === undefined ? <Note>Loading…</Note> : <NoteEditor botId={bot.id} name={name} content={loaded?.content ?? ""} isNew={loaded === null} />}
    </Page>
  );
}

function NoteEditor({ botId, name, content, isNew }: { botId: string; name: string; content: string; isNew: boolean }) {
  const { colors } = useTheme();
  const client = useBotsmanClient();
  const [fileName, setFileName] = useState(name);
  const [text, setText] = useState(content);
  const [asking, setAsking] = useState(false);
  const problem = noteNameProblem(fileName);
  const save = useAction(async () => {
    await client.saveNote(botId, fileName, text, isNew ? undefined : name);
    router.replace({ pathname: "/note/[botId]/[name]", params: { botId, name: fileName } });
  });
  const remove = useAction(async () => {
    await client.deleteNote(botId, name);
    router.back();
  });
  return (
    <View style={styles.group}>
      <Field label="File name" value={fileName} onChangeText={setFileName} />
      <TextInput accessibilityLabel="Text" multiline textAlignVertical="top" value={text} onChangeText={setText} style={[styles.editor, { color: colors.foreground, borderColor: colors.input }]} />
      <ErrorText>{problem ?? save.error ?? remove.error}</ErrorText>
      <Button label="Save" variant="primary" disabled={problem !== undefined || save.busy} onPress={() => void save.run()} />
      {isNew ? null : asking ? (
        <View style={styles.row}>
          <Button label="Delete this note" variant="danger" disabled={remove.busy} onPress={() => void remove.run()} />
          <Button label="Cancel" variant="text" onPress={() => setAsking(false)} />
        </View>
      ) : (
        <Button label="Delete" variant="danger" onPress={() => setAsking(true)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space[3] },
  row: { flexDirection: "row", gap: space[2] },
  editor: { borderWidth: 1, borderRadius: radius.md, padding: space[3], minHeight: 320, fontFamily: fontFamilies.mono, fontSize: 13 },
});

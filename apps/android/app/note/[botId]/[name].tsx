import { useBot, useNote, useNoteEditor } from "@botsman/client-core/react";
import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, TextInput, View } from "react-native";
import { fontFamilies, radius, space, useTheme } from "../../../src/theme";
import { Button } from "../../../src/ui/button";
import { ReadOnlyText } from "../../../src/ui/read-only-text";
import { Field } from "../../../src/ui/field";
import { ErrorText, Note, Page } from "../../../src/ui/page";

// One note to read, edit, rename, or delete. A name with no file yet starts a new note.
export default function NoteScreen() {
  const { botId, name } = useLocalSearchParams<{ botId: string; name: string }>();
  const bot = useBot(botId);
  const loaded = useNote(botId, name);
  if (bot === undefined) return <Page title="Note"><Note>This bot no longer exists.</Note></Page>;
  return (
    <Page title={name} subtitle={`${bot.name} · Notes`}>
      {loaded === undefined ? <Note>Loading…</Note> : <NoteEditor botId={bot.id} name={name} content={loaded?.content ?? ""} isNew={loaded === null} />}
    </Page>
  );
}

// A note shown as it reads, with Edit and Delete. A new note opens ready to write.
function NoteEditor({ botId, name, content, isNew }: { botId: string; name: string; content: string; isNew: boolean }) {
  const { colors } = useTheme();
  const { editing, startEditing, saved, fileName, setFileName, text, setText, problem, save, cancel, asking, setAsking, remove } = useNoteEditor(
    botId,
    name,
    content,
    isNew,
    (savedName) => savedName !== name && router.replace({ pathname: "/note/[botId]/[name]", params: { botId, name: savedName } }),
    () => router.back(),
  );
  if (!editing)
    return (
      <View style={styles.group}>
        <ReadOnlyText text={saved} />
        <ErrorText>{remove.error}</ErrorText>
        <Button label="Edit" onPress={startEditing} />
        {asking ? (
          <View style={styles.row}>
            <Button label="Delete this note" variant="danger" disabled={remove.busy} onPress={() => void remove.run()} />
            <Button label="Cancel" variant="text" onPress={() => setAsking(false)} />
          </View>
        ) : (
          <Button label="Delete" variant="danger" onPress={() => setAsking(true)} />
        )}
      </View>
    );
  return (
    <View style={styles.group}>
      <Field label="File name" value={fileName} onChangeText={setFileName} />
      <TextInput accessibilityLabel="Text" multiline textAlignVertical="top" value={text} onChangeText={setText} style={[styles.editor, { color: colors.foreground, borderColor: colors.input }]} />
      <ErrorText>{problem ?? save.error}</ErrorText>
      <View style={styles.row}>
        <Button label="Save" variant="primary" disabled={problem !== undefined || save.busy} onPress={() => void save.run()} />
        {isNew ? null : <Button label="Cancel" variant="text" onPress={cancel} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space[3] },
  row: { flexDirection: "row", gap: space[2] },
  editor: { borderWidth: 1, borderRadius: radius.md, padding: space[3], minHeight: 320, fontFamily: fontFamilies.mono, fontSize: 13 },
});

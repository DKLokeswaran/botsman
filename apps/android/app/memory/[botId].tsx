import { characterCount, MEMORY_FILES, memoryAudience } from "@botsman/client-core";
import { useBot, useMemoryEditor, useMemoryScreen } from "@botsman/client-core/react";
import type { MemoryFile } from "@botsman/protocol";
import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { ApprovalCard } from "../../src/chat/approval-card";
import { fontFamilies, radius, space, useTheme } from "../../src/theme";
import { Button } from "../../src/ui/button";
import { ReadOnlyText } from "../../src/ui/read-only-text";
import { ErrorText, Note, Page, pageStyles, Segmented } from "../../src/ui/page";

// The four memory files a bot loads, with its memory edits waiting for the owner.
export default function MemoryScreen() {
  const { botId } = useLocalSearchParams<{ botId: string }>();
  const bot = useBot(botId);
  const { memory, pending, open, setOpen, file, info, saved, onSaved, onEdit } = useMemoryScreen(botId);
  if (bot === undefined) return <Page title="Memory"><Note>This bot no longer exists.</Note></Page>;
  return (
    <Page title="Memory" subtitle={bot.name}>
      {pending.map((approval) => (
        <ApprovalCard key={approval.id} approvalId={approval.id} />
      ))}
      <Segmented label="Memory file" options={MEMORY_FILES.map((candidate) => ({ value: candidate.name, label: candidate.name.replace(".md", "").replace("_", " ") }))} value={open} onChange={setOpen} />
      <Note>{info.about}</Note>
      <ErrorText>{memory.error}</ErrorText>
      {file === undefined ? <Note>Loading…</Note> : <FileEditor key={`${file.name}\n${file.content}`} botId={bot.id} file={file} label={`${file.name} · ${memoryAudience(info.shared, bot.name)}`} saved={saved} onSaved={onSaved} onEdit={onEdit} />}
    </Page>
  );
}

// A memory file shown as it reads, with Edit to change it. Saving or cancelling returns to reading.
function FileEditor({ botId, file, label, saved, onSaved, onEdit }: { botId: string; file: MemoryFile; label: string; saved: boolean; onSaved: () => void; onEdit: () => void }) {
  const { colors } = useTheme();
  const { editing, startEditing, text, setText, over, canSave, save, cancel } = useMemoryEditor(botId, file, onSaved);
  return (
    <View style={styles.group}>
      <Text style={[pageStyles.rowTitle, { color: colors.foreground }]}>{label}</Text>
      {editing ? (
        <TextInput
          accessibilityLabel={file.name}
          multiline
          textAlignVertical="top"
          autoCorrect={false}
          value={text}
          onChangeText={(value) => (setText(value), onEdit())}
          style={[styles.editor, { color: colors.foreground, borderColor: colors.input }]}
        />
      ) : (
        <ReadOnlyText text={file.content} />
      )}
      <Text style={[pageStyles.small, { color: over ? colors.destructive : colors.mutedForeground }]}>{characterCount(text.length, file.limit)}</Text>
      <ErrorText>{save.error}</ErrorText>
      {saved && !editing ? <Note>Saved. Each bot gets the change with its next message.</Note> : null}
      {editing ? (
        <View style={styles.row}>
          <Button label="Save" variant="primary" disabled={!canSave} onPress={() => void save.run()} />
          <Button label="Cancel" variant="text" onPress={cancel} />
        </View>
      ) : (
        <Button label="Edit" onPress={startEditing} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space[2] },
  row: { flexDirection: "row", gap: space[2] },
  editor: { borderWidth: 1, borderRadius: radius.md, padding: space[3], minHeight: 260, fontFamily: fontFamilies.mono, fontSize: 13 },
});

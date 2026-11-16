import { characterCount, MEMORY_FILES, memoryAudience, pendingMemoryEdits } from "@botsman/client-core";
import { useAction, useBot, useBotsmanClient, useMemory, useNeedsYou } from "@botsman/client-core/react";
import type { MemoryFile, MemoryFileName } from "@botsman/protocol";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { ApprovalCard } from "../../src/chat/approval-card";
import { fontFamilies, radius, space, useTheme } from "../../src/theme";
import { Button } from "../../src/ui/button";
import { ErrorText, Note, Page, pageStyles, Segmented } from "../../src/ui/page";

// The four memory files a bot loads, with its memory edits waiting for the owner.
export default function MemoryScreen() {
  const { botId } = useLocalSearchParams<{ botId: string }>();
  const bot = useBot(botId);
  const memory = useMemory(botId);
  const pending = pendingMemoryEdits(useNeedsYou(), botId);
  const [open, setOpen] = useState<MemoryFileName>("BOT_PROFILE.md");
  const [savedFile, setSavedFile] = useState<MemoryFileName>();
  if (bot === undefined) return <Page title="Memory"><Note>This bot no longer exists.</Note></Page>;
  const file = memory.value?.files.find((candidate) => candidate.name === open);
  const info = MEMORY_FILES.find((candidate) => candidate.name === open)!;
  return (
    <Page title="Memory" subtitle={bot.name}>
      {pending.map((approval) => (
        <ApprovalCard key={approval.id} approvalId={approval.id} />
      ))}
      <Segmented label="Memory file" options={MEMORY_FILES.map((candidate) => ({ value: candidate.name, label: candidate.name.replace(".md", "").replace("_", " ") }))} value={open} onChange={setOpen} />
      <Note>{info.about}</Note>
      <ErrorText>{memory.error}</ErrorText>
      {file === undefined ? <Note>Loading…</Note> : <FileEditor key={`${file.name}\n${file.content}`} botId={bot.id} file={file} label={`${file.name} · ${memoryAudience(info.shared, bot.name)}`} saved={savedFile === file.name} onSaved={() => (setSavedFile(file.name), memory.reload())} onEdit={() => setSavedFile(undefined)} />}
    </Page>
  );
}

function FileEditor({ botId, file, label, saved, onSaved, onEdit }: { botId: string; file: MemoryFile; label: string; saved: boolean; onSaved: () => void; onEdit: () => void }) {
  const { colors } = useTheme();
  const client = useBotsmanClient();
  const [text, setText] = useState(file.content);
  const save = useAction(async () => {
    await client.saveMemory(botId, file.name, text);
    onSaved();
  });
  const over = text.length > file.limit;
  return (
    <View style={styles.group}>
      <Text style={[pageStyles.rowTitle, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        accessibilityLabel={file.name}
        multiline
        textAlignVertical="top"
        autoCorrect={false}
        value={text}
        onChangeText={(value) => (setText(value), onEdit())}
        style={[styles.editor, { color: colors.foreground, borderColor: colors.input }]}
      />
      <Text style={[pageStyles.small, { color: over ? colors.destructive : colors.mutedForeground }]}>{characterCount(text.length, file.limit)}</Text>
      <ErrorText>{save.error}</ErrorText>
      {saved ? <Note>Saved. Each bot gets the change with its next message.</Note> : null}
      <Button label="Save" variant="primary" disabled={over || text === file.content || save.busy} onPress={() => void save.run()} />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space[2] },
  editor: { borderWidth: 1, borderRadius: radius.md, padding: space[3], minHeight: 260, fontFamily: fontFamilies.mono, fontSize: 13 },
});

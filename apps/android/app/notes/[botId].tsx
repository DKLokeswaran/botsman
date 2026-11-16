import { newNoteName } from "@botsman/client-core";
import { useBot, useNotes } from "@botsman/client-core/react";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Button } from "../../src/ui/button";
import { Field } from "../../src/ui/field";
import { ErrorText, LinkRow, Note, Page } from "../../src/ui/page";

// A bot's notes, with keyword search.
export default function NotesScreen() {
  const { botId } = useLocalSearchParams<{ botId: string }>();
  const bot = useBot(botId);
  const [query, setQuery] = useState("");
  const notes = useNotes(botId, query);
  if (bot === undefined) return <Page title="Notes"><Note>This bot no longer exists.</Note></Page>;
  const all = notes.value?.notes ?? [];
  const rows = notes.value?.hits?.map((hit) => ({ name: hit.name, detail: hit.snippet })) ?? all.map((note) => ({ name: note.name, detail: `${note.size.toLocaleString("en-US")} bytes` }));
  const open = (name: string) => router.push({ pathname: "/note/[botId]/[name]", params: { botId: bot.id, name } });
  return (
    <Page title="Notes" subtitle={bot.name}>
      <Note>Longer records this bot keeps. A bot opens a note only when it needs it, and its edits here don't ask you.</Note>
      <Button label="New note" variant="primary" onPress={() => open(newNoteName(all.map((note) => note.name)))} />
      <Field label="Search" placeholder="Search by keyword" value={query} onChangeText={setQuery} />
      <ErrorText>{notes.error}</ErrorText>
      {notes.value !== undefined && rows.length === 0 ? <Note>{query.trim() === "" ? "No notes yet." : "No note matches that."}</Note> : null}
      {rows.map((row) => (
        <LinkRow key={row.name} title={row.name} detail={row.detail} onPress={() => open(row.name)} />
      ))}
    </Page>
  );
}

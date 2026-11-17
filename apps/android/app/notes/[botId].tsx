import { useBot, useNoteList } from "@botsman/client-core/react";
import { router, useLocalSearchParams } from "expo-router";
import { Button } from "../../src/ui/button";
import { Field } from "../../src/ui/field";
import { ErrorText, LinkRow, Note, Page } from "../../src/ui/page";

// A bot's notes, with keyword search.
export default function NotesScreen() {
  const { botId } = useLocalSearchParams<{ botId: string }>();
  const bot = useBot(botId);
  const { query, setQuery, error, rows, emptyText, newName } = useNoteList(botId);
  if (bot === undefined) return <Page title="Notes"><Note>This bot no longer exists.</Note></Page>;
  const open = (name: string) => router.push({ pathname: "/note/[botId]/[name]", params: { botId: bot.id, name } });
  return (
    <Page title="Notes" subtitle={bot.name}>
      <Note>Longer records this bot keeps. A bot opens a note only when it needs it, and its edits here don't ask you.</Note>
      <Button label="New note" variant="primary" onPress={() => open(newName())} />
      <Field label="Search" placeholder="Search by keyword" value={query} onChangeText={setQuery} />
      <ErrorText>{error}</ErrorText>
      {emptyText === undefined ? null : <Note>{emptyText}</Note>}
      {rows.map((row) => (
        <LinkRow key={row.name} title={row.name} detail={row.detail} onPress={() => open(row.name)} />
      ))}
    </Page>
  );
}

import type { BotsmanClient } from "@botsman/client-core";
import { useAction } from "@botsman/client-core/react";
import { useState } from "react";
import { EntryCard } from "../components/entry-card.tsx";
import { Button } from "../components/ui/button.tsx";
import { Field } from "../components/ui/field.tsx";

const SHORTEST_PASSWORD = 12;

// First-run setup: the owner's password and the main bot's name.
export function SetUpScreen({ client }: { client: BotsmanClient }) {
  const [password, setPassword] = useState("");
  const [mainBot, setMainBot] = useState("");
  const setUp = useAction(() => client.session.setUp(password, { name: mainBot.trim() }));
  const complete = password.length >= SHORTEST_PASSWORD && mainBot.trim() !== "";
  return (
    <EntryCard
      title="Set up your server"
      lede="Step 1 of 2. This first sign-in sets the owner password and creates your main bot. The main bot can change your other bots, and it cannot be deleted."
      error={setUp.error}
      onSubmit={() => void setUp.run()}
    >
      <Field label="Owner password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" hint={`At least ${SHORTEST_PASSWORD} characters.`} autoFocus />
      <Field label="Main bot's name" value={mainBot} onChange={(event) => setMainBot(event.target.value)} placeholder="Junior" />
      <Button type="submit" variant="primary" disabled={setUp.busy || !complete}>
        Continue
      </Button>
    </EntryCard>
  );
}

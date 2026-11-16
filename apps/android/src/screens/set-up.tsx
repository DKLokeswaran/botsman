import type { BotsmanClient } from "@botsman/client-core";
import { useAction } from "@botsman/client-core/react";
import { useState } from "react";
import { Button } from "../ui/button";
import { EntryCard } from "../ui/entry-card";
import { Field } from "../ui/field";

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
    >
      <Field label="Owner password" value={password} onChangeText={setPassword} secureTextEntry hint={`At least ${SHORTEST_PASSWORD} characters.`} />
      <Field label="Main bot's name" value={mainBot} onChangeText={setMainBot} placeholder="Junior" autoCapitalize="words" />
      <Button label="Continue" variant="primary" disabled={setUp.busy || !complete} onPress={() => void setUp.run()} />
    </EntryCard>
  );
}

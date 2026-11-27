import type { BotsmanClient } from "@botsman/client-core";
import { useSetUpForm } from "@botsman/client-core/react";
import { Button } from "../ui/button";
import { EntryCard } from "../ui/entry-card";
import { Field } from "../ui/field";

// First-run setup: the owner's password and the main bot's name.
export function SetUpScreen({ client }: { client: BotsmanClient }) {
  const form = useSetUpForm(client);
  return (
    <EntryCard
      title="Set up your server"
      lede="Step 1 of 2. This first sign-in sets the owner password and creates your main bot. The main bot can change your other bots, and it cannot be deleted."
      error={form.error}
    >
      <Field label="Owner password" value={form.password} onChangeText={form.setPassword} secureTextEntry hint={form.passwordHint} />
      <Field label="Main bot's name" value={form.mainBot} onChangeText={form.setMainBot} placeholder="Junior" autoCapitalize="words" />
      <Button label="Continue" variant="primary" disabled={!form.ready} onPress={form.submit} />
    </EntryCard>
  );
}

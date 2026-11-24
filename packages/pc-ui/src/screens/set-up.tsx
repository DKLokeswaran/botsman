import type { BotsmanClient } from "@botsman/client-core";
import { useSetUpForm } from "@botsman/client-core/react";
import { EntryCard } from "../components/entry-card.tsx";
import { Button } from "../components/ui/button.tsx";
import { Field } from "../components/ui/field.tsx";

// First-run setup: the owner's password and the main bot's name.
export function SetUpScreen({ client }: { client: BotsmanClient }) {
  const form = useSetUpForm(client);
  return (
    <EntryCard
      title="Set up your server"
      lede="Step 1 of 2. This first sign-in sets the owner password and creates your main bot. The main bot can change your other bots, and it cannot be deleted."
      error={form.error}
      onSubmit={form.submit}
    >
      <Field label="Owner password" type="password" value={form.password} onChange={(event) => form.setPassword(event.target.value)} autoComplete="new-password" hint={form.passwordHint} autoFocus />
      <Field label="Main bot's name" value={form.mainBot} onChange={(event) => form.setMainBot(event.target.value)} placeholder="Junior" />
      <Button type="submit" variant="primary" disabled={!form.ready}>
        Continue
      </Button>
    </EntryCard>
  );
}

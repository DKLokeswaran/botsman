import type { AppController, BotsmanClient } from "@botsman/client-core";
import { useSignInForm } from "@botsman/client-core/react";
import { EntryCard } from "../components/entry-card.tsx";
import { Button } from "../components/ui/button.tsx";
import { Field } from "../components/ui/field.tsx";

// Asks for the owner's password, on a new device or after a session ends.
export function SignInScreen({ app, client }: { app: AppController; client: BotsmanClient }) {
  const form = useSignInForm(client);
  return (
    <EntryCard title="Sign in" lede={`Enter the owner password for ${client.baseUrl}.`} error={form.error} onSubmit={form.submit}>
      <Field label="Owner password" type="password" value={form.password} onChange={(event) => form.setPassword(event.target.value)} autoComplete="current-password" autoFocus />
      <div className="flex gap-2">
        <Button type="submit" variant="primary" className="flex-1" disabled={!form.ready}>
          Sign in
        </Button>
        {app.canChangeServer ? <Button onClick={() => void app.changeServer()}>Change server</Button> : null}
      </div>
    </EntryCard>
  );
}

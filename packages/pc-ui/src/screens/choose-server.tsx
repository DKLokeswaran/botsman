import type { AppController } from "@botsman/client-core";
import { useServerForm } from "@botsman/client-core/react";
import { EntryCard } from "../components/entry-card.tsx";
import { Button } from "../components/ui/button.tsx";
import { Field } from "../components/ui/field.tsx";

// Asks for the address of the owner's Botsman server.
export function ChooseServerScreen({ app, address, error }: { app: AppController; address: string; error: string | undefined }) {
  const form = useServerForm(app, address, error);
  return (
    <EntryCard title="Connect to your server" lede="Enter the address of your server. It must use HTTPS." error={form.error} onSubmit={form.submit}>
      <Field label="Server address" value={form.address} onChange={(event) => form.setAddress(event.target.value)} placeholder="https://bots.example.com" spellCheck={false} autoFocus />
      <Button type="submit" variant="primary" disabled={!form.ready}>
        Connect
      </Button>
    </EntryCard>
  );
}

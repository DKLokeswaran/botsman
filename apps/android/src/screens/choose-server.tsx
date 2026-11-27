import type { AppController } from "@botsman/client-core";
import { useServerForm } from "@botsman/client-core/react";
import { Button } from "../ui/button";
import { EntryCard } from "../ui/entry-card";
import { Field } from "../ui/field";

// Asks for the address of the owner's Botsman server.
export function ChooseServerScreen({ app, address, error }: { app: AppController; address: string; error: string | undefined }) {
  const form = useServerForm(app, address, error);
  return (
    <EntryCard title="Connect to your server" lede="Enter the address of your server. It must use HTTPS." error={form.error}>
      <Field label="Server address" value={form.address} onChangeText={form.setAddress} placeholder="https://bots.example.com" keyboardType="url" onSubmitEditing={form.submit} />
      <Button label="Connect" variant="primary" disabled={!form.ready} onPress={form.submit} />
    </EntryCard>
  );
}

import type { AppController } from "@botsman/client-core";
import { useAction } from "@botsman/client-core/react";
import { useState } from "react";
import { Button } from "../ui/button";
import { EntryCard } from "../ui/entry-card";
import { Field } from "../ui/field";

// Asks for the address of the owner's Botsman server.
export function ChooseServerScreen({ app, address, error }: { app: AppController; address: string; error: string | undefined }) {
  const [value, setValue] = useState(address);
  const connect = useAction(() => app.connect(value));
  return (
    <EntryCard title="Connect to your server" lede="Enter the address of your server. It must use HTTPS." error={connect.error ?? error}>
      <Field label="Server address" value={value} onChangeText={setValue} placeholder="https://bots.example.com" keyboardType="url" onSubmitEditing={() => void connect.run()} />
      <Button label="Connect" variant="primary" disabled={connect.busy || value.trim() === ""} onPress={() => void connect.run()} />
    </EntryCard>
  );
}

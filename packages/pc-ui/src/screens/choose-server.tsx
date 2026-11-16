import type { AppController } from "@botsman/client-core";
import { useAction } from "@botsman/client-core/react";
import { useState } from "react";
import { EntryCard } from "../components/entry-card.tsx";
import { Button } from "../components/ui/button.tsx";
import { Field } from "../components/ui/field.tsx";

// Asks for the address of the owner's Botsman server.
export function ChooseServerScreen({ app, address, error }: { app: AppController; address: string; error: string | undefined }) {
  const [value, setValue] = useState(address);
  const connect = useAction(() => app.connect(value));
  return (
    <EntryCard title="Connect to your server" lede="Enter the address of your Botsman server. It must use HTTPS." error={connect.error ?? error} onSubmit={() => void connect.run()}>
      <Field label="Server address" value={value} onChange={(event) => setValue(event.target.value)} placeholder="https://bots.example.com" spellCheck={false} autoFocus />
      <Button type="submit" variant="primary" disabled={connect.busy || value.trim() === ""}>
        Connect
      </Button>
    </EntryCard>
  );
}

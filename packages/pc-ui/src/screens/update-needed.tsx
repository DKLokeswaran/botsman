import type { AppController } from "@botsman/client-core";
import { EntryCard } from "../components/entry-card.tsx";
import { Button } from "../components/ui/button.tsx";

const COPY = {
  update_app: { title: "Update the app", lede: "This app is too old for your server. Install the newest version of the app, then open it again." },
  update_server: { title: "Update the server", lede: "Your server is older than this app. Update Botsman on the server, then try again." },
};

// Shown when the app and the server share no protocol version. Nothing else works until one side is updated.
export function UpdateNeededScreen({ app, side, address }: { app: AppController; side: keyof typeof COPY; address: string }) {
  return (
    <EntryCard title={COPY[side].title} lede={COPY[side].lede}>
      <div className="flex gap-2">
        <Button variant="primary" className="flex-1" onClick={() => void app.connect(address)}>
          Try again
        </Button>
        {app.canChangeServer ? <Button onClick={() => void app.changeServer()}>Change server</Button> : null}
      </div>
    </EntryCard>
  );
}

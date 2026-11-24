import { type AppController, UPDATE_NEEDED } from "@botsman/client-core";
import { useStore } from "@botsman/client-core/react";
import { EntryCard } from "../components/entry-card.tsx";
import { Button } from "../components/ui/button.tsx";
import { UpdateNotice } from "../components/update-notice.tsx";
import { ServerUpdateSteps } from "../components/server-version.tsx";

// Shown when the app and the server share no protocol version. Nothing else works until one side is updated.
export function UpdateNeededScreen({ app, side, address }: { app: AppController; side: keyof typeof UPDATE_NEEDED; address: string }) {
  const health = useStore(app.serverHealth);
  return (
    <EntryCard {...UPDATE_NEEDED[side]}>
      {side === "update_app" ? <UpdateNotice updates={app.updates} /> : <ServerUpdateSteps health={health} />}
      <div className="flex gap-2">
        <Button variant="primary" className="flex-1" onClick={() => void app.connect(address)}>
          Try again
        </Button>
        {app.canChangeServer ? <Button onClick={() => void app.changeServer()}>Change server</Button> : null}
      </div>
    </EntryCard>
  );
}

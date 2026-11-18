import { type AppController, SERVER_UPDATE_COMMAND, serverUpdate, serverUpdateText, serverVersionLine } from "@botsman/client-core";
import { useStore } from "@botsman/client-core/react";

// The connected server's version, and how to update it when a newer release exists.
export function ServerVersion({ app }: { app: AppController }) {
  const health = useStore(app.serverHealth);
  if (health === undefined) return null;
  const update = serverUpdate(health);
  return (
    <div className="flex flex-col gap-2">
      <p className="rounded-lg border border-border px-3 py-2.5 text-sm">{serverVersionLine(health)}</p>
      {update === undefined ? null : <ServerUpdateSteps version={update} />}
    </div>
  );
}

// The command that updates the server, which the owner runs on the server itself.
export function ServerUpdateSteps({ version }: { version: string | undefined }) {
  return (
    <div role="status" className="flex flex-col gap-2 rounded-lg border border-primary p-3 text-sm">
      <p>{serverUpdateText(version)}</p>
      <code className="select-all rounded-md bg-muted px-2 py-1 font-mono">{SERVER_UPDATE_COMMAND}</code>
    </div>
  );
}

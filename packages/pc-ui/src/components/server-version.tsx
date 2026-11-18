import { type AppController, serverUpdate, serverUpdateSteps, serverVersionLine } from "@botsman/client-core";
import { useStore } from "@botsman/client-core/react";
import type { Health } from "@botsman/protocol";

// The connected server's version, and how to update it when a newer release exists.
export function ServerVersion({ app }: { app: AppController }) {
  const health = useStore(app.serverHealth);
  if (health === undefined) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="rounded-lg border border-border px-3 py-2.5 text-sm">{serverVersionLine(health)}</p>
      {serverUpdate(health) === undefined ? null : <ServerUpdateSteps health={health} />}
    </div>
  );
}

// The command that updates the server, which the owner runs on the server itself.
export function ServerUpdateSteps({ health }: { health: Health | undefined }) {
  const steps = serverUpdateSteps(health);
  return (
    <div role="status" className="flex flex-col gap-2 rounded-lg border border-primary p-3 text-sm">
      <p>{steps.text}</p>
      <code className="select-all rounded-md bg-muted px-2 py-1 font-mono">{steps.command}</code>
    </div>
  );
}

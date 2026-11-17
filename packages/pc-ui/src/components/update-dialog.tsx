import { asksToUpdate, type UpdateChecker } from "@botsman/client-core";
import { useDeclinedUpdate, useUpdateInfo, useUpdateState } from "@botsman/client-core/react";
import { Button } from "./ui/button.tsx";

// "Update available": asks once per new version, with Not now and Install. Settings keeps Install for later.
export function UpdateDialog({ updates }: { updates: UpdateChecker | undefined }) {
  const state = useUpdateState(updates);
  const declined = useDeclinedUpdate(updates);
  const info = useUpdateInfo(updates);
  if (updates === undefined || state.status === "none" || !asksToUpdate(state, declined)) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-labelledby="update-title" className="flex w-full max-w-sm flex-col gap-3 rounded-xl border border-border bg-card p-5">
        <h2 id="update-title" className="font-display text-base font-bold uppercase">
          {state.status === "installing" ? "Installing" : "Update available"}
        </h2>
        <p className="text-sm">
          {state.status === "installing" ? `Installing ${state.version}. The app restarts when it's done.` : `Version ${state.version} is ready to install.${info.installed === undefined ? "" : ` You're on ${info.installed}.`}`}
        </p>
        {state.status === "failed" ? <p className="text-sm text-destructive">{state.error}</p> : null}
        {state.status === "installing" ? null : (
          <div className="flex justify-end gap-2">
            <Button onClick={() => updates.notNow()}>Not now</Button>
            <Button variant="primary" onClick={() => void updates.install()}>
              {state.status === "failed" ? "Try again" : "Install"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

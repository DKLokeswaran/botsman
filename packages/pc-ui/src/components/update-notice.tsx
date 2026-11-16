import type { UpdateChecker } from "@botsman/client-core";
import { useUpdateState } from "@botsman/client-core/react";
import { Button } from "./ui/button.tsx";

// Says when a newer build of the app is ready, and installs it on request. It shows nothing when the app is
// current, and nothing on the web dashboard, which comes with the server.
export function UpdateNotice({ updates }: { updates: UpdateChecker | undefined }) {
  const state = useUpdateState(updates);
  if (updates === undefined || state.status === "none") return null;
  return (
    <div role="status" className="flex flex-col gap-2 rounded-lg border border-primary p-3 text-sm">
      <p>{state.status === "installing" ? `Installing ${state.version}…` : `Version ${state.version} is ready to install.`}</p>
      {state.status === "failed" ? <p className="text-destructive">{state.error}</p> : null}
      {state.status === "installing" ? null : (
        <Button variant="primary" onClick={() => void updates.install()}>
          {state.status === "failed" ? "Try again" : "Install"}
        </Button>
      )}
    </div>
  );
}

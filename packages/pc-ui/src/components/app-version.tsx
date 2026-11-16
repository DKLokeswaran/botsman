import { type UpdateChecker, versionLine } from "@botsman/client-core";
import { useUpdateInfo, useUpdateState } from "@botsman/client-core/react";
import { UpdateNotice } from "./update-notice.tsx";
import { Button } from "./ui/button.tsx";

// This app's version, whether it is up to date, and a way to check now. The web dashboard updates with the server.
export function AppVersion({ updates }: { updates: UpdateChecker | undefined }) {
  const info = useUpdateInfo(updates);
  const state = useUpdateState(updates);
  if (updates === undefined) return <p className="text-sm text-muted-foreground">The dashboard updates with the server.</p>;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
        <span className="text-sm">{versionLine(info, state)}</span>
        <Button disabled={info.checking || state.status === "installing"} onClick={() => void updates.checkNow()}>
          Check for updates
        </Button>
      </div>
      <UpdateNotice updates={updates} />
    </div>
  );
}

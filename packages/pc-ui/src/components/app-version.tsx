import type { UpdateChecker } from "@botsman/client-core";
import { useAppVersion } from "@botsman/client-core/react";
import { UpdateNotice } from "./update-notice.tsx";
import { Button } from "./ui/button.tsx";

// This app's version, whether it is up to date, and a way to check now. The web dashboard updates with the server.
export function AppVersion({ updates }: { updates: UpdateChecker | undefined }) {
  const { line, canCheck } = useAppVersion(updates);
  if (updates === undefined) return <p className="text-sm text-muted-foreground">The dashboard updates with the server.</p>;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
        <span className="text-sm">{line}</span>
        <Button disabled={!canCheck} onClick={() => void updates.checkNow()}>
          Check for updates
        </Button>
      </div>
      <UpdateNotice updates={updates} />
    </div>
  );
}

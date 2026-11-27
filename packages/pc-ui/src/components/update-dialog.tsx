import type { UpdateChecker } from "@botsman/client-core";
import { useUpdateDialog } from "@botsman/client-core/react";
import { Button } from "./ui/button.tsx";

const INSTALLING_NOTE = "The app restarts when it's done.";

// "Update available": asks once per new version, with Not now and Install. Settings keeps Install for later.
export function UpdateDialog({ updates }: { updates: UpdateChecker | undefined }) {
  const dialog = useUpdateDialog(updates, INSTALLING_NOTE);
  if (updates === undefined || dialog === undefined) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-labelledby="update-title" className="flex w-full max-w-sm flex-col gap-3 rounded-xl border border-border bg-card p-5">
        <h2 id="update-title" className="font-display text-base font-bold uppercase">
          {dialog.title}
        </h2>
        <p className="text-sm">
          {dialog.message}
        </p>
        {dialog.error === undefined ? null : <p className="text-sm text-destructive">{dialog.error}</p>}
        {dialog.install === undefined ? null : (
          <div className="flex justify-end gap-2">
            <Button onClick={() => updates.notNow()}>Not now</Button>
            <Button variant="primary" onClick={() => void updates.install()}>
              {dialog.install}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

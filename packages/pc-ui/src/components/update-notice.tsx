import type { UpdateChecker } from "@botsman/client-core";
import { useUpdateNotice } from "@botsman/client-core/react";
import { Button } from "./ui/button.tsx";

// Says when a newer build of the app is ready, and installs it on request. It shows nothing when the app is
// current, and nothing on the web dashboard, which comes with the server.
export function UpdateNotice({ updates }: { updates: UpdateChecker | undefined }) {
  const notice = useUpdateNotice(updates);
  if (updates === undefined || notice === undefined) return null;
  return (
    <div role="status" className="flex flex-col gap-2 rounded-lg border border-primary p-3 text-sm">
      <p>{notice.notice}</p>
      {notice.error === undefined ? null : <p className="text-destructive">{notice.error}</p>}
      {notice.install === undefined ? null : (
        <Button variant="primary" onClick={() => void updates.install()}>
          {notice.install}
        </Button>
      )}
    </div>
  );
}

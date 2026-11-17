import { useEffect, useState } from "react";
import type { BackgroundAlerts, BackgroundStatus } from "../background-alerts.ts";
import { useStore } from "./hooks.ts";

const STATUS_POLL_MS = 3_000;

// Whether the background connection is on, and its status, read again every few seconds. `onResume`, where the app has
// one, also reads it when the owner comes back to the app, and returns a way to stop listening.
export function useBackgroundStatus(background: BackgroundAlerts, onResume?: (read: () => void) => () => void): { enabled: boolean; status: BackgroundStatus | undefined } {
  const enabled = useStore(background.enabled) ?? true;
  const [status, setStatus] = useState<BackgroundStatus>();
  useEffect(() => {
    const read = () => void background.status().then(setStatus);
    read();
    const timer = setInterval(read, STATUS_POLL_MS);
    const stopListening = onResume?.(read);
    return () => {
      clearInterval(timer);
      stopListening?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [background, enabled]);
  return { enabled, status };
}

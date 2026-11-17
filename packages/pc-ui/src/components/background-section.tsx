import { type BackgroundAlerts, backgroundLine } from "@botsman/client-core";
import { useAction, useBackgroundStatus } from "@botsman/client-core/react";
import { useEffect, useState } from "react";
import type { Autostart } from "../platform.ts";
import { ErrorText, ToggleRow } from "./page.tsx";

// The alerts connection that runs while the window is hidden, and starting with the computer.
export function BackgroundSection({ background, autostart }: { background: BackgroundAlerts; autostart: Autostart | undefined }) {
  const { enabled, status } = useBackgroundStatus(background);
  return (
    <>
      <h2 className="font-display text-sm font-bold uppercase">Alerts when the window is closed</h2>
      <ToggleRow title="Keep connected" detail="Botsman stays in the tray, keeps its connection to your server, and posts its own notifications." on={enabled} onChange={(on) => void background.setKeepConnected(on)} />
      {status === undefined ? null : <p className="text-xs text-muted-foreground">{backgroundLine(status, enabled)}</p>}
      {autostart === undefined ? null : <StartWithComputer autostart={autostart} />}
    </>
  );
}

function StartWithComputer({ autostart }: { autostart: Autostart }) {
  const [on, setOn] = useState<boolean>();
  useEffect(() => void autostart.isEnabled().then(setOn), [autostart]);
  const change = useAction(async (next: boolean) => {
    await autostart.set(next);
    setOn(next);
  });
  if (on === undefined) return null;
  return (
    <>
      <ToggleRow title="Start with Windows" detail="Opens hidden in the tray when you sign in to Windows." on={on} onChange={(next) => void change.run(next)} />
      <ErrorText>{change.error}</ErrorText>
    </>
  );
}

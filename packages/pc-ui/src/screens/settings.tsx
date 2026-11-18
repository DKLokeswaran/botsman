import { ALERT_CHOICES, THEME_MODES, type ThemeMode, type AppController, type BotsmanClient, deviceDetail } from "@botsman/client-core";
import { useAlertSettings, useDevices } from "@botsman/client-core/react";
import type { DeviceSession } from "@botsman/protocol";
import { ErrorText, LinkRow, Page, Segmented, ToggleRow } from "../components/page.tsx";
import { Button } from "../components/ui/button.tsx";
import { AppVersion } from "../components/app-version.tsx";
import { ServerVersion } from "../components/server-version.tsx";
import type { Autostart, NotificationPermission } from "../platform.ts";
import { BackgroundSection } from "../components/background-section.tsx";

// Whether this page may show notifications, and a way to ask. `ask` is missing where the page never notifies itself.
export type NotificationChoice = { permission: NotificationPermission; ask: (() => Promise<void>) | undefined };

// This device's theme choice and the way to change it.
export type ThemeChoice = [ThemeMode, (mode: ThemeMode) => void];

// Alerts, signed-in devices, providers, the theme, the server's and the app's versions, and the server this app uses.
export function SettingsScreen({ app, client, notifications, autostart, theme }: { app: AppController; client: BotsmanClient; notifications: NotificationChoice; autostart: Autostart | undefined; theme: ThemeChoice }) {
  const { alertSettings, save } = useAlertSettings();
  return (
    <Page title="Settings" subtitle={new URL(client.baseUrl).host} back="#/">
      <h2 className="font-display text-sm font-bold uppercase">Alerts</h2>
      <p className="text-sm text-muted-foreground">These apply to every device signed in to this server.</p>
      {alertSettings === undefined ? <p className="text-sm text-muted-foreground">This server doesn't keep alert settings yet.</p> : null}
      {alertSettings === undefined
        ? null
        : ALERT_CHOICES.map((choice) => <ToggleRow key={choice.kind} title={choice.label} detail={choice.detail} on={alertSettings[choice.kind]} onChange={(on) => void save.run(choice.kind, on)} />)}
      <ErrorText>{save.error}</ErrorText>
      <BrowserNotifications choice={notifications} />
      {app.background === undefined ? null : <BackgroundSection appName={app.appName} background={app.background} autostart={autostart} />}
      <LinkRow href="#/providers" title="Model providers" detail="Keys and sign-ins for the models your bots use" />
      <Devices />
      <h2 className="font-display text-sm font-bold uppercase">Mode</h2>
      <Segmented label="Mode" options={THEME_MODES.map((option) => ({ value: option.mode, label: option.label }))} value={theme[0]} onChange={theme[1]} />
      <h2 className="font-display text-sm font-bold uppercase">Server</h2>
      <ServerVersion app={app} />
      <h2 className="font-display text-sm font-bold uppercase">This app</h2>
      <AppVersion appName={app.appName} updates={app.updates} />
      <div className="flex gap-2">
        <Button onClick={() => void client.session.signOut()}>Sign out</Button>
        {app.canChangeServer ? <Button onClick={() => void app.changeServer()}>Change server</Button> : null}
      </div>
    </Page>
  );
}

const PERMISSION_TEXT: Record<NotificationPermission, string> = {
  granted: "On. Alerts show while this page is open in the background.",
  denied: "Blocked in this browser's site settings.",
  default: "Off. Alerts show only inside the page.",
  unsupported: "This browser can't show notifications.",
};

function BrowserNotifications({ choice }: { choice: NotificationChoice }) {
  if (choice.ask === undefined) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
      <span>
        <span className="block text-sm font-semibold">Browser notifications</span>
        <span className="block text-xs text-muted-foreground">{PERMISSION_TEXT[choice.permission]}</span>
      </span>
      {choice.permission === "default" ? <Button onClick={() => void choice.ask?.()}>Turn on</Button> : null}
    </div>
  );
}

function Devices() {
  const { devices, error, revoke } = useDevices();
  return (
    <>
      <h2 className="font-display text-sm font-bold uppercase">Signed-in devices</h2>
      <ErrorText>{error}</ErrorText>
      {devices === undefined ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {(devices ?? []).map((session) => (
        <DeviceRow key={session.id} session={session} busy={revoke.busy} onRevoke={() => void revoke.run(session.id)} />
      ))}
    </>
  );
}

function DeviceRow({ session, busy, onRevoke }: { session: DeviceSession; busy: boolean; onRevoke: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
      <span>
        <span className="block text-sm font-semibold">{session.deviceName}</span>
        <span className="block text-xs text-muted-foreground">{deviceDetail(session)}</span>
      </span>
      {session.current ? null : (
        <Button variant="danger" disabled={busy} onClick={onRevoke}>
          Sign out
        </Button>
      )}
    </div>
  );
}

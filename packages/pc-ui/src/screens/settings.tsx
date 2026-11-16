import { ALERT_CHOICES, type AppController, type BotsmanClient, formatMessageTime, liveSessions } from "@botsman/client-core";
import { useAction, useServerState, useSessions } from "@botsman/client-core/react";
import type { DeviceSession } from "@botsman/protocol";
import { ErrorText, LinkRow, Page, ToggleRow } from "../components/page.tsx";
import { Button } from "../components/ui/button.tsx";
import { UpdateNotice } from "../components/update-notice.tsx";

// Alerts, signed-in devices, providers, the app's version, and the server this app uses.
export function SettingsScreen({ app, client }: { app: AppController; client: BotsmanClient }) {
  const { alertSettings } = useServerState();
  const save = useAction((kind: string, on: boolean) => client.updateAlertSettings({ [kind]: on }));
  return (
    <Page title="Settings" subtitle={new URL(client.baseUrl).host} back="#/">
      <h2 className="font-display text-sm font-bold uppercase">Alerts</h2>
      <p className="text-sm text-muted-foreground">These apply to every device signed in to this server.</p>
      {alertSettings === undefined ? <p className="text-sm text-muted-foreground">This server doesn't keep alert settings yet.</p> : null}
      {alertSettings === undefined
        ? null
        : ALERT_CHOICES.map((choice) => <ToggleRow key={choice.kind} title={choice.label} detail={choice.detail} on={alertSettings[choice.kind]} onChange={(on) => void save.run(choice.kind, on)} />)}
      <ErrorText>{save.error}</ErrorText>
      <LinkRow href="#/providers" title="Model providers" detail="Keys and sign-ins for the models your bots use" />
      <Devices client={client} />
      <h2 className="font-display text-sm font-bold uppercase">This app</h2>
      <UpdateNotice updates={app.updates} />
      <div className="flex gap-2">
        <Button onClick={() => void client.session.signOut()}>Sign out</Button>
        {app.canChangeServer ? <Button onClick={() => void app.changeServer()}>Change server</Button> : null}
      </div>
    </Page>
  );
}

function Devices({ client }: { client: BotsmanClient }) {
  const sessions = useSessions();
  const revoke = useAction(async (sessionId: string) => {
    await client.revokeSession(sessionId);
    sessions.reload();
  });
  return (
    <>
      <h2 className="font-display text-sm font-bold uppercase">Signed-in devices</h2>
      <ErrorText>{sessions.error ?? revoke.error}</ErrorText>
      {sessions.value === undefined ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {liveSessions(sessions.value ?? []).map((session) => (
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
        <span className="block text-xs text-muted-foreground">{session.current ? "This device" : `Last used ${formatMessageTime(session.lastUsedAt, Date.now())}`}</span>
      </span>
      {session.current ? null : (
        <Button variant="danger" disabled={busy} onClick={onRevoke}>
          Sign out
        </Button>
      )}
    </div>
  );
}

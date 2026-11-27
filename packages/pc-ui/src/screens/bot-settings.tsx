import { useBotSettings } from "@botsman/client-core/react";
import { ErrorText, Page, Segmented, ToggleRow } from "../components/page.tsx";
import { botInfoHref } from "../use-route.ts";

// How much a bot may do without asking: its permission mode, how long approvals wait, and network access.
export function BotSettingsScreen({ botId }: { botId: string }) {
  const { bot, modes, modeNote, waits, change, error } = useBotSettings(botId);
  if (bot === undefined) return <p className="p-6 text-muted-foreground">This bot no longer exists.</p>;
  return (
    <Page title={bot.name} subtitle="Bot settings" back={botInfoHref(bot.id)}>
      <h2 className="font-display text-sm font-bold uppercase">Permissions</h2>
      <Segmented label="Permission mode" options={modes} value={bot.permissionMode} onChange={(permissionMode) => change({ permissionMode })} />
      <p className="text-sm text-muted-foreground">{modeNote}</p>
      <ApprovalWait ms={bot.approvalWaitMs} waits={waits} onChange={(approvalWaitMs) => change({ approvalWaitMs })} />
      <ToggleRow title="Network" detail="Commands run by this bot can reach the internet" on={bot.network} onChange={(network) => change({ network })} />
      <ErrorText>{error}</ErrorText>
    </Page>
  );
}

function ApprovalWait({ ms, waits, onChange }: { ms: number; waits: ReturnType<typeof useBotSettings>["waits"]; onChange: (ms: number) => void }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">Approval wait</span>
      <select className="rounded-lg border border-input bg-background px-3 py-2" value={ms} onChange={(event) => onChange(Number(event.target.value))}>
        {waits.map((wait) => (
          <option key={wait.ms} value={wait.ms}>
            {wait.label}
          </option>
        ))}
      </select>
      <span className="text-xs text-muted-foreground">If you don't answer in time, the action is refused and the bot is told.</span>
    </label>
  );
}

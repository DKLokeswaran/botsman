import { APPROVAL_WAITS, approvalWaitLabel, type Bot } from "@botsman/client-core";
import { useBotSettings } from "@botsman/client-core/react";
import { ErrorText, Page, Segmented, ToggleRow } from "../components/page.tsx";
import { botInfoHref } from "../use-route.ts";

// How much a bot may do without asking: its permission mode, how long approvals wait, and network access.
export function BotSettingsScreen({ botId }: { botId: string }) {
  const { bot, modes, modeNote, change, error } = useBotSettings(botId);
  if (bot === undefined) return <p className="p-6 text-muted-foreground">This bot no longer exists.</p>;
  return (
    <Page title={bot.name} subtitle="Bot settings" back={botInfoHref(bot.id)}>
      <h2 className="font-display text-sm font-bold uppercase">Permissions</h2>
      <Segmented label="Permission mode" options={modes} value={bot.permissionMode} onChange={(permissionMode) => change({ permissionMode })} />
      <p className="text-sm text-muted-foreground">{modeNote}</p>
      <ApprovalWait bot={bot} onChange={(approvalWaitMs) => change({ approvalWaitMs })} />
      <ToggleRow title="Network" detail="Commands run by this bot can reach the internet" on={bot.network} onChange={(network) => change({ network })} />
      <ErrorText>{error}</ErrorText>
    </Page>
  );
}

function ApprovalWait({ bot, onChange }: { bot: Bot; onChange: (ms: number) => void }) {
  const known = APPROVAL_WAITS.some((wait) => wait.ms === bot.approvalWaitMs);
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">Approval wait</span>
      <select className="rounded-lg border border-input bg-background px-3 py-2" value={bot.approvalWaitMs} onChange={(event) => onChange(Number(event.target.value))}>
        {known ? null : <option value={bot.approvalWaitMs}>{approvalWaitLabel(bot.approvalWaitMs)}</option>}
        {APPROVAL_WAITS.map((wait) => (
          <option key={wait.ms} value={wait.ms}>
            {wait.label}
          </option>
        ))}
      </select>
      <span className="text-xs text-muted-foreground">If you don't answer in time, the action is refused and the bot is told.</span>
    </label>
  );
}

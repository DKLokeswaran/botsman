import { APPROVAL_WAITS, approvalWaitLabel, PERMISSION_MODES } from "@botsman/client-core";
import { useAction, useBot, useBotsmanClient } from "@botsman/client-core/react";
import type { Bot, BotUpdate } from "@botsman/protocol";
import { ErrorText, Page, Segmented, ToggleRow } from "../components/page.tsx";
import { botInfoHref } from "../use-route.ts";

// How much a bot may do without asking: its permission mode, how long approvals wait, and network access.
export function BotSettingsScreen({ botId }: { botId: string }) {
  const bot = useBot(botId);
  const client = useBotsmanClient();
  const save = useAction((change: BotUpdate) => client.updateBot(botId, change));
  if (bot === undefined) return <p className="p-6 text-muted-foreground">This bot no longer exists.</p>;
  const mode = PERMISSION_MODES.find((option) => option.mode === bot.permissionMode)!;
  return (
    <Page title={bot.name} subtitle="Bot settings" back={botInfoHref(bot.id)}>
      <h2 className="font-display text-sm font-bold uppercase">Permissions</h2>
      <Segmented label="Permission mode" options={PERMISSION_MODES.map((option) => ({ value: option.mode, label: option.label }))} value={bot.permissionMode} onChange={(mode) => void save.run({ permissionMode: mode })} />
      <p className="text-sm text-muted-foreground">{mode.note} Memory edits always ask, in every mode.</p>
      <ApprovalWait bot={bot} onChange={(approvalWaitMs) => void save.run({ approvalWaitMs })} />
      <ToggleRow title="Network" detail="Commands run by this bot can reach the internet" on={bot.network} onChange={(network) => void save.run({ network })} />
      <ErrorText>{save.error}</ErrorText>
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

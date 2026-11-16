import { type AppController, type BotsmanClient, botRowText, formatCountdown } from "@botsman/client-core";
import { useBotActivity, useBots, useConnectionStatus, useNeedsYou, useNow, useServerState } from "@botsman/client-core/react";
import type { Approval, Bot } from "@botsman/protocol";
import { Avatar } from "../components/avatar.tsx";
import { Button } from "../components/ui/button.tsx";
import { UpdateNotice } from "../components/update-notice.tsx";
import { chatHref, useRoute } from "../use-route.ts";
import { ChatScreen } from "./chat.tsx";

// The main window: the bot list beside the open chat. Home is the main bot's chat.
export function Shell({ app, client }: { app: AppController; client: BotsmanClient }) {
  const route = useRoute();
  const { status, bots } = useServerState();
  const openBotId = route.name === "chat" ? route.botId : bots[0]?.id;
  return (
    <div className="flex h-screen">
      <Sidebar app={app} client={client} openBotId={openBotId} />
      {status === "loading" || openBotId === undefined ? <p className="p-6 text-muted-foreground">Loading…</p> : <ChatScreen key={openBotId} botId={openBotId} />}
    </div>
  );
}

function Sidebar({ app, client, openBotId }: { app: AppController; client: BotsmanClient; openBotId: string | undefined }) {
  const bots = useBots();
  const needsYou = useNeedsYou();
  const waitingBots = new Set(needsYou.map((approval) => approval.botId));
  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-r border-border">
      <div className="px-4 py-4 font-display text-lg tracking-[0.3em] uppercase">Botsman</div>
      <nav className="flex-1 overflow-y-auto px-2">
        {needsYou.length === 0 ? null : (
          <>
            <SectionTitle>Needs you</SectionTitle>
            {needsYou.map((approval) => (
              <NeedsYouRow key={approval.id} approval={approval} bot={bots.find((bot) => bot.id === approval.botId)} />
            ))}
          </>
        )}
        <SectionTitle>Bots</SectionTitle>
        {bots.map((bot) => (
          <BotRow key={bot.id} bot={bot} open={bot.id === openBotId} needsYou={waitingBots.has(bot.id)} />
        ))}
      </nav>
      <SidebarFooter app={app} client={client} />
    </aside>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="px-2 pt-4 pb-2 text-sm font-semibold text-primary">{children}</h2>;
}

function NeedsYouRow({ approval, bot }: { approval: Approval; bot: Bot | undefined }) {
  const now = useNow();
  const kind = approval.memoryEdit === null ? "Approval" : "Memory edit";
  return (
    <a href={chatHref(approval.botId)} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-accent">
      <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">
          {bot?.name ?? "Bot"} · {kind}
        </span>
        <span className="block truncate text-sm">{approval.description}</span>
      </span>
      <span className="font-mono text-xs text-muted-foreground">{formatCountdown(approval.expiresAt, now)}</span>
    </a>
  );
}

function BotRow({ bot, open, needsYou }: { bot: Bot; open: boolean; needsYou: boolean }) {
  const text = botRowText(bot.description, useBotActivity(bot.id), useNow(60_000));
  return (
    <a href={chatHref(bot.id)} aria-current={open ? "page" : undefined} className={`flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent ${open ? "bg-accent" : ""}`}>
      <Avatar bot={bot} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate font-display text-sm font-bold uppercase">{bot.name}</span>
          {bot.isMain ? <span className="text-xs text-muted-foreground">Main</span> : null}
        </span>
        <span className="block truncate text-sm text-muted-foreground">{text.subtitle}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-xs text-muted-foreground">{text.time}</span>
        {needsYou ? <span className="text-xs font-semibold">Needs you</span> : null}
        {text.unread === "" ? null : (
          <span aria-label={`${text.unread} unread`} className="min-w-5 rounded-full bg-primary px-1.5 text-center font-mono text-xs text-primary-foreground">
            {text.unread}
          </span>
        )}
      </span>
    </a>
  );
}

const CONNECTION_LABELS = { offline: "Offline", connecting: "Connecting…", online: "Connected to", reconnecting: "Reconnecting to" };

function SidebarFooter({ app, client }: { app: AppController; client: BotsmanClient }) {
  const status = useConnectionStatus();
  const host = new URL(client.baseUrl).host;
  return (
    <footer className="flex flex-col gap-2 border-t border-border p-3">
      <UpdateNotice updates={app.updates} />
      <p className="truncate text-xs text-muted-foreground" role="status">
        {CONNECTION_LABELS[status]} {status === "online" || status === "reconnecting" ? host : ""}
      </p>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => void client.session.signOut()}>
          Sign out
        </Button>
        {app.canChangeServer ? <Button onClick={() => void app.changeServer()}>Change server</Button> : null}
      </div>
    </footer>
  );
}

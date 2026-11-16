import { type AppController, type BotsmanClient, botRowText, formatCountdown } from "@botsman/client-core";
import { useBotActivity, useBots, useConnectionStatus, useNeedsYou, useNow, useServerState } from "@botsman/client-core/react";
import type { Approval, Bot } from "@botsman/protocol";
import { Avatar } from "../components/avatar.tsx";
import { Button } from "../components/ui/button.tsx";
import { UpdateDialog } from "../components/update-dialog.tsx";
import type { Autostart, PageNotifications } from "../platform.ts";
import { useAlertNotifications } from "../use-alert-notifications.ts";
import { chatHref, type Route, useRoute } from "../use-route.ts";
import { useState } from "react";
import { BotInfoScreen } from "./bot-info.tsx";
import { BotSettingsScreen } from "./bot-settings.tsx";
import { ChatScreen } from "./chat.tsx";
import { MemoryScreen } from "./memory.tsx";
import { NewBotScreen } from "./new-bot.tsx";
import { NoteScreen, NotesScreen } from "./notes.tsx";
import { ProvidersScreen } from "./providers.tsx";
import { type NotificationChoice, SettingsScreen, type ThemeChoice } from "./settings.tsx";
import { UsageScreen } from "./usage.tsx";

// The main window: the bot list beside the open chat. Home is the main bot's chat.
export function Shell({ app, client, notifications, autostart, theme }: { app: AppController; client: BotsmanClient; notifications: PageNotifications | undefined; autostart: Autostart | undefined; theme: ThemeChoice }) {
  const route = useRoute();
  const [permission, setPermission] = useState(() => notifications?.permission() ?? "unsupported");
  useAlertNotifications(client, notifications, permission === "granted");
  const askForNotifications = notifications === undefined ? undefined : async () => setPermission(await notifications.ask());
  const { status, bots } = useServerState();
  const openBotId = "botId" in route ? route.botId : route.name === "home" ? bots[0]?.id : undefined;
  return (
    <div className="flex h-screen">
      <UpdateDialog updates={app.updates} />
      <Sidebar app={app} client={client} openBotId={openBotId} />
      <MainPane app={app} client={client} route={route} loading={status === "loading"} botId={openBotId} notifications={{ permission, ask: askForNotifications }} autostart={autostart} theme={theme} />
    </div>
  );
}

// The page beside the bot list. Home is the main bot's chat.
function MainPane({ app, client, route, loading, botId, notifications, autostart, theme }: { app: AppController; client: BotsmanClient; route: Route; loading: boolean; botId: string | undefined; notifications: NotificationChoice; autostart: Autostart | undefined; theme: ThemeChoice }) {
  if (route.name === "new-bot") return <NewBotScreen />;
  if (route.name === "providers") return <ProvidersScreen />;
  if (route.name === "usage") return <UsageScreen />;
  if (route.name === "settings") return <SettingsScreen app={app} client={client} notifications={notifications} autostart={autostart} theme={theme} />;
  if (loading || botId === undefined) return <p className="p-6 text-muted-foreground">Loading…</p>;
  if (route.name === "bot") return <BotInfoScreen key={botId} botId={botId} />;
  if (route.name === "bot-settings") return <BotSettingsScreen key={botId} botId={botId} />;
  if (route.name === "memory") return <MemoryScreen key={botId} botId={botId} />;
  if (route.name === "notes") return <NotesScreen key={botId} botId={botId} />;
  if (route.name === "note") return <NoteScreen key={`${botId}/${route.note}`} botId={botId} name={route.note} />;
  return <ChatScreen key={botId} botId={botId} />;
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
        <a href="#/new-bot" className="mt-1 block rounded-lg px-2 py-2 text-sm font-semibold text-primary hover:bg-accent">
          New bot
        </a>
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
      <nav className="flex gap-1">
        <a href="#/usage" className="flex-1 rounded-lg px-2 py-1.5 text-center text-sm font-semibold hover:bg-accent">
          Usage
        </a>
        <a href="#/settings" className="flex-1 rounded-lg px-2 py-1.5 text-center text-sm font-semibold hover:bg-accent">
          Settings
        </a>
      </nav>
      <p className="truncate text-xs text-muted-foreground" role="status">
        {CONNECTION_LABELS[status]} {status === "online" || status === "reconnecting" ? host : ""}
      </p>
    </footer>
  );
}

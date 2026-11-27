import type { AppController, Approval, Bot, BotsmanClient } from "@botsman/client-core";
import { useAppName, useBotRow, useBots, useConnectionLine, useNeedsYou, useNeedsYouRow, useServerState } from "@botsman/client-core/react";
import { Avatar } from "../components/avatar.tsx";
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
      <Sidebar openBotId={openBotId} />
      <MainPane app={app} route={route} loading={status === "loading"} botId={openBotId} notifications={{ permission, ask: askForNotifications }} autostart={autostart} theme={theme} />
    </div>
  );
}

// The page beside the bot list. Home is the main bot's chat.
function MainPane({ app, route, loading, botId, notifications, autostart, theme }: { app: AppController; route: Route; loading: boolean; botId: string | undefined; notifications: NotificationChoice; autostart: Autostart | undefined; theme: ThemeChoice }) {
  if (route.name === "new-bot") return <NewBotScreen />;
  if (route.name === "providers") return <ProvidersScreen />;
  if (route.name === "usage") return <UsageScreen />;
  if (route.name === "settings") return <SettingsScreen app={app} notifications={notifications} autostart={autostart} theme={theme} />;
  if (loading || botId === undefined) return <p className="p-6 text-muted-foreground">Loading…</p>;
  return <BotPage route={route} botId={botId} />;
}

// One bot's pages. Its home is its chat.
function BotPage({ route, botId }: { route: Route; botId: string }) {
  if (route.name === "bot") return <BotInfoScreen key={botId} botId={botId} />;
  if (route.name === "bot-settings") return <BotSettingsScreen key={botId} botId={botId} />;
  if (route.name === "memory") return <MemoryScreen key={botId} botId={botId} />;
  if (route.name === "notes") return <NotesScreen key={botId} botId={botId} />;
  if (route.name === "note") return <NoteScreen key={`${botId}/${route.note}`} botId={botId} name={route.note} />;
  return <ChatScreen key={botId} botId={botId} />;
}

function Sidebar({ openBotId }: { openBotId: string | undefined }) {
  const appName = useAppName();
  const bots = useBots();
  const needsYou = useNeedsYou();
  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-r border-border">
      <div className="px-4 py-4 font-display text-lg tracking-[0.3em] uppercase">{appName}</div>
      <nav className="flex-1 overflow-y-auto px-2">
        {needsYou.length === 0 ? null : (
          <>
            <SectionTitle>Needs you</SectionTitle>
            {needsYou.map((approval) => (
              <NeedsYouRow key={approval.id} approval={approval} />
            ))}
          </>
        )}
        <SectionTitle>Bots</SectionTitle>
        {bots.map((bot) => (
          <BotRow key={bot.id} bot={bot} open={bot.id === openBotId} />
        ))}
        <a href="#/new-bot" className="mt-1 block rounded-lg px-2 py-2 text-sm font-semibold text-primary hover:bg-accent">
          New bot
        </a>
      </nav>
      <SidebarFooter />
    </aside>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="px-2 pt-4 pb-2 text-sm font-semibold text-primary">{children}</h2>;
}

function NeedsYouRow({ approval }: { approval: Approval }) {
  const { line, countdown } = useNeedsYouRow(approval);
  return (
    <a href={chatHref(approval.botId)} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-accent">
      <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">{line}</span>
        <span className="block truncate text-sm">{approval.description}</span>
      </span>
      <span className="font-mono text-xs text-muted-foreground">{countdown}</span>
    </a>
  );
}

function BotRow({ bot, open }: { bot: Bot; open: boolean }) {
  const row = useBotRow(bot);
  return (
    <a href={chatHref(bot.id)} aria-current={open ? "page" : undefined} className={`flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent ${open ? "bg-accent" : ""}`}>
      <Avatar bot={bot} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate font-display text-sm font-bold uppercase">{bot.name}</span>
          {bot.isMain ? <span className="text-xs text-muted-foreground">Main</span> : null}
        </span>
        <span className="block truncate text-sm text-muted-foreground">{row.subtitle}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-xs text-muted-foreground">{row.time}</span>
        {row.working ? (
          <span className="flex items-center gap-1 text-xs font-semibold">
            <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-primary" />
            Working
          </span>
        ) : null}
        {row.needsYou ? <span className="text-xs font-semibold">Needs you</span> : null}
        {row.unread === "" ? null : (
          <span aria-label={`${row.unread} unread`} className="min-w-5 rounded-full bg-primary px-1.5 text-center font-mono text-xs text-primary-foreground">
            {row.unread}
          </span>
        )}
      </span>
    </a>
  );
}

function SidebarFooter() {
  const connection = useConnectionLine();
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
        {connection}
      </p>
    </footer>
  );
}

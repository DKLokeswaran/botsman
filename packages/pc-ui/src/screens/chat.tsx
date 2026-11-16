import { chatSubtitle } from "@botsman/client-core";
import { useBot, useChat, useConnectionStatus } from "@botsman/client-core/react";
import { useEffect, useRef } from "react";
import { Avatar } from "../components/avatar.tsx";
import { ChatItemView } from "../components/chat-items.tsx";
import { Composer } from "../components/composer.tsx";
import { Button } from "../components/ui/button.tsx";

// One bot's chat with the owner.
export function ChatScreen({ botId }: { botId: string }) {
  const bot = useBot(botId);
  const { chat, state, items, sendModes } = useChat(botId);
  const reconnecting = useConnectionStatus() === "reconnecting";
  const scroller = useStickToBottom(items);

  if (bot === undefined) return <p className="p-6 text-muted-foreground">This bot no longer exists.</p>;
  const busy = state.live.running || state.live.compacting;
  return (
    <section className="flex h-full min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Avatar bot={bot} />
        <div className="min-w-0">
          <h1 className="truncate font-display text-base font-bold uppercase">{bot.name}</h1>
          <p className="truncate text-xs text-muted-foreground">{chatSubtitle(state.settings, state.totals.usage.cost)}</p>
        </div>
      </header>
      {reconnecting ? (
        <p role="status" className="border-b border-border bg-card px-4 py-1.5 text-center text-xs text-primary">
          Reconnecting…
        </p>
      ) : null}
      <div ref={scroller} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[var(--reading-width)] flex-col gap-5 px-4 py-6">
          {state.hasEarlier ? (
            <Button variant="text" className="self-center" onClick={() => void chat.loadEarlier()}>
              Show earlier messages
            </Button>
          ) : null}
          {state.status === "loading" ? <p className="text-center text-sm text-muted-foreground">Loading…</p> : null}
          {items.map((item) => (
            <ChatItemView key={item.id} item={item} chat={chat} botName={bot.name} />
          ))}
          {state.live.compacting ? <p className="text-center text-xs text-muted-foreground">Compacting the chat…</p> : null}
        </div>
      </div>
      <div className="mx-auto w-full max-w-[var(--reading-width)] px-4 pb-4">
        <Composer chat={chat} botName={bot.name} sendModes={sendModes} busy={busy} />
      </div>
    </section>
  );
}

// Keeps the newest message in view while the owner is at the bottom, and leaves their place alone when they
// have scrolled up to read.
function useStickToBottom(content: unknown) {
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  useEffect(() => {
    const element = scroller.current;
    if (element === null) return;
    const onScroll = () => (atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80);
    element.addEventListener("scroll", onScroll);
    return () => element.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    const element = scroller.current;
    if (element !== null && atBottom.current) element.scrollTop = element.scrollHeight;
  }, [content]);
  return scroller;
}

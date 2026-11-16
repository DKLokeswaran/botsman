import { chatSubtitle, modelProblem } from "@botsman/client-core";
import { useBot, useChat, useConnectionStatus, useModels } from "@botsman/client-core/react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "../components/avatar.tsx";
import { ChatItemView } from "../components/chat-items.tsx";
import { Composer } from "../components/composer.tsx";
import { ModelPicker } from "../components/model-picker.tsx";
import { Button } from "../components/ui/button.tsx";
import { botInfoHref } from "../use-route.ts";

// One bot's chat with the owner.
export function ChatScreen({ botId }: { botId: string }) {
  const bot = useBot(botId);
  const { chat, state, items, sendModes } = useChat(botId);
  const reconnecting = useConnectionStatus() === "reconnecting";
  const scroller = useStickToBottom(items);
  const [picking, setPicking] = useState(false);
  const { models, loading } = useModels();
  const problem = loading || state.status === "loading" ? undefined : modelProblem(models, state.settings.model);

  if (bot === undefined) return <p className="p-6 text-muted-foreground">This bot no longer exists.</p>;
  const busy = state.live.running || state.live.compacting;
  return (
    <section className="flex h-full min-w-0 flex-1 flex-col">
      <header className="relative flex items-center gap-3 border-b border-border px-4 py-3">
        <a href={botInfoHref(bot.id)} aria-label={`${bot.name} info`} className="rounded-lg hover:opacity-80">
          <Avatar bot={bot} />
        </a>
        <div className="min-w-0">
          <a href={botInfoHref(bot.id)} className="block truncate font-display text-base font-bold uppercase hover:opacity-80">
            {bot.name}
          </a>
          <button type="button" aria-expanded={picking} onClick={() => setPicking(!picking)} className="truncate text-xs text-muted-foreground hover:text-foreground">
            {chatSubtitle(state.settings, state.totals.usage.cost)} ▾
          </button>
        </div>
        {picking ? <ModelPicker chat={chat} settings={state.settings} bot={bot} onClose={() => setPicking(false)} /> : null}
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
      <div className="mx-auto flex w-full max-w-[var(--reading-width)] flex-col gap-2 px-4 pb-4">
        {problem === undefined ? null : (
          <p role="status" className="flex items-center justify-between gap-3 rounded-lg border border-primary px-3 py-2 text-sm">
            <span>{problem}</span>
            <a href="#/providers" className="shrink-0 font-semibold text-primary underline">
              Model providers
            </a>
          </p>
        )}
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

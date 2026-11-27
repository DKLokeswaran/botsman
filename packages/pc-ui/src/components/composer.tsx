import { type ChatController, modelChipLabel, type SendMode, type SlashCommand, type SlashScreen, type Bot, type ChatSettings } from "@botsman/client-core";
import { useComposer, useModels } from "@botsman/client-core/react";
import { ICONS } from "@botsman/tokens";
import { type KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { MarkIcon } from "./avatar.tsx";
import { memoryHref, notesHref } from "../use-route.ts";
import { ModelPicker } from "./model-picker.tsx";
import { Button } from "./ui/button.tsx";

// Where the owner writes. Enter sends in the first offered mode, and Shift+Enter starts a new line. A message starting
// with / offers commands. Below the text: the attach and image buttons, the model chip that opens the model picker, and Send, or Queue, Steer, and Stop while the bot works.
export function Composer({ chat, bot, settings, sendModes, busy }: { chat: ChatController; bot: Bot; settings: ChatSettings; sendModes: SendMode[]; busy: boolean }) {
  const { text, setText, label, placeholder, matches, empty, send, command, stop } = useComposer(chat, bot.name, busy, (screen, botId) => (window.location.hash = screenHref(screen, botId)));
  const [picking, setPicking] = useState(false);
  const { models } = useModels();
  const grow = useAutoGrow(text);
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    send(sendModes[0]!);
  };

  const box = useCloseOnOutside(picking, () => setPicking(false));
  return (
    <div ref={box} className="relative flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
      {picking ? <ModelPicker chat={{ controller: chat, settings }} bot={bot} onClose={() => setPicking(false)} className="absolute right-0 bottom-full z-10 mb-2 w-80" /> : null}
      {matches === undefined ? null : <SlashMenu matches={matches} onPick={(picked) => void command.run(picked)} />}
      {command.error === undefined ? null : <p className="text-sm text-destructive">{command.error}</p>}
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        ref={grow}
        rows={1}
        placeholder={placeholder}
        aria-label={label}
        className="max-h-[40vh] resize-none overflow-y-auto bg-transparent px-1 py-1 outline-none placeholder:text-muted-foreground"
      />
      <div className="flex items-center gap-2">
        <ComingSoon label="Attach a file" paths={ICONS.attach} />
        <ComingSoon label="Add an image" paths={ICONS.image} />
        <span className="flex-1" />
        <button type="button" aria-expanded={picking} onClick={() => setPicking(!picking)} className="truncate rounded-md bg-muted px-2.5 py-1.5 text-xs font-semibold hover:bg-accent">
          {modelChipLabel(settings, models)}
        </button>
        <SendButtons busy={busy} sendModes={sendModes} empty={empty} send={send} stop={stop} />
      </div>
    </div>
  );
}

type Composing = ReturnType<typeof useComposer>;

// Send while the bot is idle. While it works: Queue and Steer where the chat offers them, and Stop.
function SendButtons({ busy, sendModes, empty, send, stop }: { busy: boolean; sendModes: SendMode[]; empty: boolean; send: Composing["send"]; stop: Composing["stop"] }) {
  return busy ? (
    <>
      {sendModes.includes("queue") ? (
        <Button variant="text" disabled={empty} onClick={() => send("queue")}>
          Queue
        </Button>
      ) : null}
      {sendModes.includes("steer") ? (
        <Button disabled={empty} onClick={() => send("steer")}>
          Steer
        </Button>
      ) : null}
      <Button variant="danger" disabled={stop.busy} onClick={() => void stop.run()}>
        <span aria-hidden className="size-2.5 rounded-[1px] bg-current" /> Stop
      </Button>
    </>
  ) : (
    <button type="button" aria-label="Send" disabled={empty} onClick={() => send("send")} className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}

// A toolbar button for a feature that hasn't arrived yet: shown, but disabled.
function ComingSoon({ label, paths }: { label: string; paths: readonly string[] }) {
  return (
    <button type="button" disabled aria-label={label} title={`${label} · coming in a later update`} className="flex size-8 items-center justify-center rounded-md text-muted-foreground opacity-40">
      <MarkIcon paths={paths} size={18} />
    </button>
  );
}

// Closes a panel when the owner clicks anywhere outside the box that holds it.
function useCloseOnOutside(open: boolean, close: () => void) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => box.current?.contains(event.target as Node) || close();
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, close]);
  return box;
}

function SlashMenu({ matches, onPick }: { matches: SlashCommand[]; onPick: (command: SlashCommand) => void }) {
  if (matches.length === 0) return <p className="px-1 text-sm text-muted-foreground">No matching command</p>;
  return (
    <div role="listbox" aria-label="Commands" className="flex flex-col border-b border-border pb-2">
      {matches.map((match) => (
        <button key={match.name} type="button" role="option" aria-selected={false} onClick={() => onPick(match)} className="flex items-baseline gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent">
          <span className="font-mono font-semibold">/{match.name}</span>
          <span className="text-muted-foreground">{match.hint}</span>
        </button>
      ))}
    </div>
  );
}

function screenHref(screen: SlashScreen, botId: string): string {
  if (screen === "memory") return memoryHref(botId);
  if (screen === "notes") return notesHref(botId);
  return "#/usage";
}

// Sizes the box to its text, wrapped lines included, up to the CSS max height, past which it scrolls.
function useAutoGrow(text: string) {
  const box = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = box.current;
    if (element === null) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [text]);
  return box;
}

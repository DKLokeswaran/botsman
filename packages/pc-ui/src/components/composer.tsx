import { type ChatController, exactCommand, modelChipLabel, runCommand, type SendMode, type SlashCommand, type SlashScreen, slashMatches } from "@botsman/client-core";
import { useAction, useModels } from "@botsman/client-core/react";
import type { Bot, ChatSettings } from "@botsman/protocol";
import { type KeyboardEvent, useLayoutEffect, useRef, useState } from "react";
import { memoryHref, notesHref } from "../use-route.ts";
import { ModelPicker } from "./model-picker.tsx";
import { Button } from "./ui/button.tsx";

// Where the owner writes. Enter sends in the first offered mode, and Shift+Enter starts a new line. Below the text: a
// commands button, the model chip that opens the model picker, and Send, or Queue, Steer, and Stop while the bot works.
export function Composer({ chat, bot, settings, sendModes, busy }: { chat: ChatController; bot: Bot; settings: ChatSettings; sendModes: SendMode[]; busy: boolean }) {
  const [text, setText] = useState("");
  const [picking, setPicking] = useState(false);
  const { models } = useModels();
  const stop = useAction(() => chat.stop());
  const command = useAction(async (picked: SlashCommand) => {
    setText("");
    const action = await runCommand(picked, chat);
    if (action.kind === "open") window.location.hash = screenHref(action.screen, chat.botId);
  });
  const matches = slashMatches(text);
  const grow = useAutoGrow(text);

  const send = (mode: SendMode) => {
    const message = text.trim();
    if (message === "") return;
    const named = exactCommand(message);
    if (named !== undefined) return void command.run(named);
    setText("");
    void chat.send(message, mode);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    send(sendModes[0]!);
  };

  const empty = text.trim() === "";
  return (
    <div className="relative flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
      {picking ? <ModelPicker chat={{ controller: chat, settings }} bot={bot} onClose={() => setPicking(false)} className="absolute right-0 bottom-full z-10 mb-2 w-80" /> : null}
      {matches === undefined ? null : <SlashMenu matches={matches} onPick={(picked) => void command.run(picked)} />}
      {command.error === undefined ? null : <p className="text-sm text-destructive">{command.error}</p>}
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        ref={grow}
        rows={1}
        placeholder={busy ? "Queue a message" : `Message ${bot.name}`}
        aria-label={`Message ${bot.name}`}
        className="max-h-[40vh] resize-none overflow-y-auto bg-transparent px-1 py-1 outline-none placeholder:text-muted-foreground"
      />
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Commands" onClick={() => setText(text === "" ? "/" : text)} className="flex size-8 items-center justify-center rounded-md font-mono text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
          /
        </button>
        <span className="flex-1" />
        <button type="button" aria-expanded={picking} onClick={() => setPicking(!picking)} className="truncate rounded-md bg-muted px-2.5 py-1.5 text-xs font-semibold hover:bg-accent">
          {modelChipLabel(settings, models)}
        </button>
        {busy ? (
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
            <Button disabled={stop.busy} onClick={() => void stop.run()}>
              <span aria-hidden className="size-2.5 rounded-[1px] bg-current" /> Stop
            </Button>
          </>
        ) : (
          <button type="button" aria-label="Send" disabled={empty} onClick={() => send("send")} className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
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

import { type ChatController, exactCommand, runCommand, type SendMode, type SlashCommand, type SlashScreen, slashMatches } from "@botsman/client-core";
import { useAction } from "@botsman/client-core/react";
import { type KeyboardEvent, useState } from "react";
import { memoryHref, notesHref } from "../use-route.ts";
import { Button } from "./ui/button.tsx";

const SEND_LABELS: Record<SendMode, string> = { send: "Send", queue: "Queue", steer: "Steer" };

// Where the owner writes. Enter sends in the first offered mode, and Shift+Enter starts a new line.
// While the bot is busy it offers Queue and Steer, and a Stop button. A message starting with / offers commands.
export function Composer({ chat, botName, sendModes, busy }: { chat: ChatController; botName: string; sendModes: SendMode[]; busy: boolean }) {
  const [text, setText] = useState("");
  const stop = useAction(() => chat.stop());
  const command = useAction(async (picked: SlashCommand) => {
    setText("");
    const action = await runCommand(picked, chat);
    if (action.kind === "help") setText("/");
    if (action.kind === "open") window.location.hash = screenHref(action.screen, chat.botId);
  });
  const matches = slashMatches(text);

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

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
      {matches === undefined ? null : <SlashMenu matches={matches} onPick={(picked) => void command.run(picked)} />}
      {command.error === undefined ? null : <p className="text-sm text-destructive">{command.error}</p>}
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        rows={Math.min(8, Math.max(1, text.split("\n").length))}
        placeholder={`Message ${botName}`}
        aria-label={`Message ${botName}`}
        className="resize-none bg-transparent px-1 py-1 outline-none placeholder:text-muted-foreground"
      />
      <div className="flex items-center justify-end gap-2">
        {busy ? (
          <Button variant="danger" disabled={stop.busy} onClick={() => void stop.run()}>
            Stop
          </Button>
        ) : null}
        {sendModes.map((mode, index) => (
          <Button key={mode} variant={index === 0 ? "primary" : "ghost"} disabled={text.trim() === ""} onClick={() => send(mode)}>
            {SEND_LABELS[mode]}
          </Button>
        ))}
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

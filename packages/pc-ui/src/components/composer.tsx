import type { ChatController, SendMode } from "@botsman/client-core";
import { useAction } from "@botsman/client-core/react";
import { type KeyboardEvent, useState } from "react";
import { Button } from "./ui/button.tsx";

const SEND_LABELS: Record<SendMode, string> = { send: "Send", queue: "Queue", steer: "Steer" };

// Where the owner writes. Enter sends in the first offered mode, and Shift+Enter starts a new line.
// While the bot is busy it offers Queue and Steer, and a Stop button.
export function Composer({ chat, botName, sendModes, busy }: { chat: ChatController; botName: string; sendModes: SendMode[]; busy: boolean }) {
  const [text, setText] = useState("");
  const stop = useAction(() => chat.stop());

  const send = (mode: SendMode) => {
    const message = text.trim();
    if (message === "") return;
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

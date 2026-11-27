import { useState } from "react";
import type { ChatController } from "../chat-controller.ts";
import type { SendMode } from "../send-rule.ts";
import { exactCommand, runCommand, type SlashCommand, type SlashScreen, slashMatches } from "../slash.ts";
import { useAction } from "./use-action.ts";

// The message box's text and what it does: sending in a mode, running a command typed or picked from the list, and
// stopping the reply. `matches` lists the commands for a message that starts with /, and `placeholder` says what a message
// does while the bot is busy. `openScreen` takes the owner to
// the screen a command opens.
export function useComposer(chat: ChatController, botName: string, busy: boolean, openScreen: (screen: SlashScreen, botId: string) => void) {
  const [text, setText] = useState("");
  const stop = useAction(() => chat.stop());
  const command = useAction(async (picked: SlashCommand) => {
    setText("");
    const action = await runCommand(picked, chat);
    if (action.kind === "open") openScreen(action.screen, chat.botId);
  });

  // A message that is exactly a command runs it instead of reaching the bot.
  const send = (mode: SendMode) => {
    const message = text.trim();
    if (message === "") return;
    const named = exactCommand(message);
    if (named !== undefined) return void command.run(named);
    setText("");
    void chat.send(message, mode);
  };

  const label = `Message ${botName}`;
  return { text, setText, label, placeholder: busy ? "Queue a message" : label, matches: slashMatches(text), empty: text.trim() === "", send, command, stop };
}

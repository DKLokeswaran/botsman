import type { ChatController } from "./chat-controller.ts";

export type SlashCommand = { name: string; hint: string };

// Commands for actions with no button. Skills arrive with M4.
const SLASH_COMMANDS: readonly SlashCommand[] = [
  { name: "compact", hint: "Summarize this chat into the context" },
  { name: "clear", hint: "Clear this chat's context" },
  { name: "memory", hint: "Open this bot's memory files" },
  { name: "notes", hint: "Open this bot's notes" },
  { name: "usage", hint: "Tokens and cost by day and by bot" },
];

// The commands to offer while the message is a single word starting with a slash, or undefined when it isn't.
export function slashMatches(text: string): SlashCommand[] | undefined {
  if (!/^\/\S*$/.test(text)) return undefined;
  const query = text.slice(1).toLowerCase();
  return SLASH_COMMANDS.filter((command) => command.name.startsWith(query) || command.hint.toLowerCase().includes(query));
}

// The command a message names exactly, such as "/clear".
export function exactCommand(text: string): SlashCommand | undefined {
  return SLASH_COMMANDS.find((command) => `/${command.name}` === text.trim());
}

export type SlashScreen = "memory" | "notes" | "usage";

// What a command does: runs on the chat, or opens a screen.
export type SlashAction = { kind: "done" } | { kind: "open"; screen: SlashScreen };

export async function runCommand(command: SlashCommand, chat: ChatController): Promise<SlashAction> {
  if (command.name === "compact") return (await chat.compact(), { kind: "done" });
  if (command.name === "clear") return (await chat.clear(), { kind: "done" });
  return { kind: "open", screen: command.name as SlashScreen };
}

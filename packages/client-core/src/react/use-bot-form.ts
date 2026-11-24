import { type Bot, BotLimits, type BotUpdate, type PermissionMode } from "@botsman/protocol";
import { useState } from "react";
import { botNameProblem, PERMISSION_MODES, permissionNote } from "../bot-settings.ts";
import { useBotsmanClient } from "./client-context.tsx";
import { useBot } from "./hooks.ts";
import { useAction } from "./use-action.ts";

// The name and description form on bot info. Save shows once something changed, and spaces around the text don't count
// as a change. A name that can't be saved says why.
export function useBotNameForm(bot: Bot) {
  const client = useBotsmanClient();
  const [name, setName] = useState(bot.name);
  const [description, setDescription] = useState(bot.description);
  const typed = { name: name.trim(), description: description.trim() };
  const changed = typed.name !== bot.name || typed.description !== bot.description;
  const problem = changed ? botNameProblem(name) : undefined;
  const save = useAction(() => client.updateBot(bot.id, typed));
  const ready = changed && problem === undefined && !save.busy;
  return { name, setName, description, setDescription, limits: BotLimits, changed, ready, error: problem ?? save.error, submit: () => void (ready && save.run()) };
}

// Bot settings: the bot, the permission modes to choose from and what the chosen one does, and changing a setting. The
// bot is undefined once it is deleted.
export function useBotSettings(botId: string) {
  const client = useBotsmanClient();
  const bot = useBot(botId);
  const save = useAction((change: BotUpdate) => client.updateBot(botId, change));
  const modes = PERMISSION_MODES.map((option): { value: PermissionMode; label: string } => ({ value: option.mode, label: option.label }));
  return { bot, modes, modeNote: bot === undefined ? "" : permissionNote(bot.permissionMode), change: (update: BotUpdate) => void save.run(update), error: save.error };
}

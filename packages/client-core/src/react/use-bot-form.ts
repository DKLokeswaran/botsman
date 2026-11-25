import { type Avatar, type Bot, BotLimits, type BotUpdate, type PermissionMode } from "@botsman/protocol";
import { useState } from "react";
import { approvalWaitChoices, botNameProblem, PERMISSION_MODES, permissionNote, photoAvatar } from "../bot-settings.ts";
import { useBotsmanClient } from "./client-context.tsx";
import { useBot } from "./use-server-state.ts";
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

// Bot settings: the bot, the permission modes to choose from and what the chosen one does, the approval waits, and changing a setting. The
// bot is undefined once it is deleted.
export function useBotSettings(botId: string) {
  const client = useBotsmanClient();
  const bot = useBot(botId);
  const save = useAction((change: BotUpdate) => client.updateBot(botId, change));
  const modes = PERMISSION_MODES.map((option): { value: PermissionMode; label: string } => ({ value: option.mode, label: option.label }));
  const shown = bot === undefined ? { modeNote: "", waits: [] } : { modeNote: permissionNote(bot.permissionMode), waits: approvalWaitChoices(bot.approvalWaitMs) };
  return { bot, modes, ...shown, change: (update: BotUpdate) => void save.run(update), error: save.error };
}

// The bot's picture: choosing a mark, going back to the initial with null, or uploading a photo. `upload` takes the
// platform's way to get a shrunk photo, which answers undefined when the owner cancels.
export function useBotPhoto(bot: Bot) {
  const client = useBotsmanClient();
  const save = useAction((avatar: Avatar | null) => client.updateBot(bot.id, { avatar }));
  const upload = useAction(async (getPhoto: () => Promise<string | undefined>) => {
    const dataUrl = await getPhoto();
    if (dataUrl !== undefined) await client.updateBot(bot.id, { avatar: photoAvatar(dataUrl) });
  });
  return {
    chosenMark: bot.avatar?.kind === "mark" ? bot.avatar.mark : undefined,
    canClear: bot.avatar !== null,
    choose: (avatar: Avatar | null) => void save.run(avatar),
    upload: (getPhoto: () => Promise<string | undefined>) => void upload.run(getPhoto),
    uploading: upload.busy,
    error: save.error ?? upload.error,
  };
}

// Deleting a bot, which asks first. `onDeleted` leaves the bot's screens.
export function useDeleteBot(bot: Bot, onDeleted: () => void) {
  const client = useBotsmanClient();
  const [asking, setAsking] = useState(false);
  const remove = useAction(async () => {
    await client.deleteBot(bot.id);
    onDeleted();
  });
  const question = `Delete ${bot.name}? It leaves the apps, and its data stays on the server. The main bot can restore it.`;
  return { asking, setAsking, question, remove: () => void remove.run(), busy: remove.busy, error: remove.error };
}

import { BotLimits, type ModelInfo, type ModelRef } from "@botsman/protocol";
import { useState } from "react";
import { botNameProblem, type ModelChoice, modelChoices, suggestedModel } from "../bot-settings.ts";
import { formatBytes } from "../format.ts";
import { useBotsmanClient } from "./client-context.tsx";
import { useBots } from "./use-server-state.ts";
import { useAction } from "./use-action.ts";
import { useFreeSpace, useModels } from "./use-models.ts";

// The new-bot form: its fields, the model (the suggested one until the owner picks, null for none), the folder's free
// space, the first thing wrong (the name, then a folder the server refuses, then a failed create), and creating the bot.
// A model is chosen by its key, and the empty key is none. `onCreated` gets the new bot's id, so each app opens its chat.
export function useNewBotDraft(onCreated: (botId: string) => void) {
  const client = useBotsmanClient();
  const main = useBots().find((bot) => bot.isMain);
  const { models, loading } = useModels();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [purpose, setPurpose] = useState("");
  const [picked, setPicked] = useState<ModelRef | null>();
  const [folder, setFolder] = useState("");
  const space = useFreeSpace(folder);
  const model = picked === undefined ? suggestedModel(models, main?.defaultModel) : picked;
  const choices = modelChoices(models, model);
  const problem = name === "" ? undefined : botNameProblem(name);
  const create = useAction(async () => {
    const bot = await client.createBot({ name: name.trim(), description: description.trim(), purpose: purpose.trim(), defaultModel: model, folder: folder.trim() });
    onCreated(bot.id);
  });
  const folderAllowed = space?.allowed !== false;
  return {
    name,
    setName,
    description,
    setDescription,
    purpose,
    setPurpose,
    limits: BotLimits,
    models: choices,
    modelKey: chosenKey(choices),
    loading,
    modelHint: modelHint(models, loading),
    chooseModel: (key: string) => setPicked(choices.find((choice) => choice.key === key)?.ref ?? null),
    folder,
    setFolder,
    folderHint: folderHint(space),
    error: problem ?? folderRefusal(space) ?? create.error,
    ready: name.trim() !== "" && problem === undefined && folderAllowed && !create.busy,
    create,
  };
}

// The key of the chosen model, or the empty key for none.
function chosenKey(choices: readonly ModelChoice[]): string {
  return choices.find((choice) => choice.chosen)?.key ?? "";
}

// What the model field says when there is nothing to choose.
function modelHint(models: readonly ModelInfo[], loading: boolean): string | undefined {
  return !loading && models.length === 0 ? "Connect a model provider to choose a model." : undefined;
}

type FreeSpace = ReturnType<typeof useFreeSpace>;

// The folder field's hint, with the folder's free space once it is known.
function folderHint(space: FreeSpace): string {
  const free = space === undefined ? "" : ` Free space: ${formatBytes(space.freeBytes)} of ${formatBytes(space.totalBytes)}.`;
  return `Leave it empty for the default. The bot can read and write everything in this folder.${free}`;
}

// Why the server refuses the folder, if it does.
function folderRefusal(space: FreeSpace): string | undefined {
  return space?.allowed === false ? space.reason : undefined;
}

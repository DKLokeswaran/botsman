import type { ModelRef } from "@botsman/protocol";
import { useState } from "react";
import { botNameProblem, suggestedModel } from "../bot-settings.ts";
import { formatBytes } from "../format.ts";
import { useBotsmanClient } from "./client-context.tsx";
import { useBots } from "./hooks.ts";
import { useAction } from "./use-action.ts";
import { useFreeSpace, useModels } from "./use-models.ts";

// The new-bot form: its fields, the model (the suggested one until the owner picks, null for none), the folder's free
// space, the first thing wrong (the name, then a folder the server refuses, then a failed create), and creating the bot.
// `onCreated` gets the new bot's id, so each app opens its chat.
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
    models,
    loading,
    model,
    setModel: setPicked,
    folder,
    setFolder,
    folderHint: folderHint(space),
    error: problem ?? folderRefusal(space) ?? create.error,
    ready: name.trim() !== "" && problem === undefined && folderAllowed,
    create,
  };
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

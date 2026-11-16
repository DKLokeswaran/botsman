import { botNameProblem, formatBytes, modelLabel, sameModel, suggestedModel } from "@botsman/client-core";
import { useAction, useBots, useBotsmanClient, useFreeSpace, useModels } from "@botsman/client-core/react";
import type { FreeSpace, ModelInfo, ModelRef } from "@botsman/protocol";
import { useState } from "react";
import { ErrorText, Page } from "../components/page.tsx";
import { Button } from "../components/ui/button.tsx";
import { Field } from "../components/ui/field.tsx";

// Creates a bot with its own folder, files, and chat. It starts with Manual permissions.
export function NewBotScreen() {
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
    window.location.hash = `#/chat/${encodeURIComponent(bot.id)}`;
  });
  const ready = name.trim() !== "" && problem === undefined && space?.allowed !== false;
  return (
    <Page title="New bot" back="#/">
      <p className="text-sm text-muted-foreground">The bot gets its own folder, its own files, and its own chat. It starts with Manual permissions.</p>
      <Field label="Name" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} />
      <Field label="Description" placeholder="Shown in the bot list" value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} />
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Purpose</span>
        <textarea rows={6} maxLength={6000} placeholder="What this bot is for. Saved as BOT_PROFILE.md." className="rounded-lg border border-input bg-background px-3 py-2 outline-none focus:border-ring" value={purpose} onChange={(event) => setPurpose(event.target.value)} />
      </label>
      <ModelSelect models={models} loading={loading} value={model} onChange={setPicked} />
      <Field label="Folder on the server" placeholder="~/.botsman/workspaces/<id>" spellCheck={false} value={folder} onChange={(event) => setFolder(event.target.value)} hint={folderHint(space)} />
      <ErrorText>{problem ?? (space?.allowed === false ? space.reason : undefined) ?? create.error}</ErrorText>
      <Button variant="primary" className="self-start" disabled={!ready || create.busy} onClick={() => void create.run()}>
        Create bot
      </Button>
    </Page>
  );
}

function ModelSelect({ models, loading, value, onChange }: { models: ModelInfo[]; loading: boolean; value: ModelRef | null; onChange: (model: ModelRef | null) => void }) {
  const chosen = models.findIndex((model) => sameModel(model, value));
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">Default model</span>
      <select className="rounded-lg border border-input bg-background px-3 py-2" value={chosen} onChange={(event) => onChange(toRef(models[Number(event.target.value)]))}>
        <option value={-1}>{loading ? "Loading…" : "None yet"}</option>
        {models.map((model, index) => (
          <option key={`${model.provider}/${model.id}`} value={index}>
            {modelLabel(model)}
          </option>
        ))}
      </select>
      {!loading && models.length === 0 ? <span className="text-xs text-muted-foreground">Connect a model provider to choose a model.</span> : null}
    </label>
  );
}

function toRef(model: ModelInfo | undefined): ModelRef | null {
  return model === undefined ? null : { provider: model.provider, modelId: model.id };
}

function folderHint(space: FreeSpace | undefined): string {
  const free = space === undefined ? "" : ` Free space: ${formatBytes(space.freeBytes)} of ${formatBytes(space.totalBytes)}.`;
  return `Leave it empty for the default. The bot can read and write everything in this folder.${free}`;
}

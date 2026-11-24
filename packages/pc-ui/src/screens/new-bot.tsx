import { useNewBotDraft } from "@botsman/client-core/react";
import { ErrorText, Page } from "../components/page.tsx";
import { Button } from "../components/ui/button.tsx";
import { Field } from "../components/ui/field.tsx";

// Creates a bot with its own folder, files, and chat. It starts with Manual permissions.
export function NewBotScreen() {
  const draft = useNewBotDraft((botId) => (window.location.hash = `#/chat/${encodeURIComponent(botId)}`));
  const { name, setName, description, setDescription, purpose, setPurpose, folder, setFolder } = draft;
  return (
    <Page title="New bot" back="#/">
      <p className="text-sm text-muted-foreground">The bot gets its own folder, its own files, and its own chat. It starts with Manual permissions.</p>
      <Field label="Name" value={name} maxLength={draft.limits.name} onChange={(event) => setName(event.target.value)} />
      <Field label="Description" placeholder="Shown in the bot list" value={description} maxLength={draft.limits.description} onChange={(event) => setDescription(event.target.value)} />
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Purpose</span>
        <textarea rows={6} maxLength={draft.limits.purpose} placeholder="What this bot is for. Saved as BOT_PROFILE.md." className="rounded-lg border border-input bg-background px-3 py-2 outline-none focus:border-ring" value={purpose} onChange={(event) => setPurpose(event.target.value)} />
      </label>
      <ModelSelect draft={draft} />
      <Field label="Folder on the server" placeholder="~/.botsman/workspaces/<id>" spellCheck={false} value={folder} onChange={(event) => setFolder(event.target.value)} hint={draft.folderHint} />
      <ErrorText>{draft.error}</ErrorText>
      <Button variant="primary" className="self-start" disabled={!draft.ready} onClick={() => void draft.create.run()}>
        Create bot
      </Button>
    </Page>
  );
}

// The bot's default model, or none.
function ModelSelect({ draft }: { draft: ReturnType<typeof useNewBotDraft> }) {
  const { models, setModel } = draft;
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">Default model</span>
      <select className="rounded-lg border border-input bg-background px-3 py-2" value={models.find((model) => model.chosen)?.key ?? ""} onChange={(event) => setModel(models.find((model) => model.key === event.target.value)?.ref ?? null)}>
        <option value="">{draft.loading ? "Loading…" : "None yet"}</option>
        {models.map((model) => (
          <option key={model.key} value={model.key}>
            {model.label}
          </option>
        ))}
      </select>
      {draft.modelHint === undefined ? null : <span className="text-xs text-muted-foreground">{draft.modelHint}</span>}
    </label>
  );
}

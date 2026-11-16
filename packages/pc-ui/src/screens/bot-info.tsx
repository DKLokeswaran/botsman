import { botNameProblem, modelDefaultLabel, photoAvatar } from "@botsman/client-core";
import { useAction, useBot, useBotsmanClient } from "@botsman/client-core/react";
import type { Avatar as AvatarValue, Bot } from "@botsman/protocol";
import { MARK_IDS, MARKS } from "@botsman/tokens";
import { useRef, useState } from "react";
import { Avatar, MarkIcon } from "../components/avatar.tsx";
import { ModelPicker } from "../components/model-picker.tsx";
import { ErrorText, LinkRow, Page } from "../components/page.tsx";
import { Button } from "../components/ui/button.tsx";
import { Field } from "../components/ui/field.tsx";
import { shrinkPhoto } from "../photo.ts";
import { botSettingsHref, chatHref, memoryHref, notesHref } from "../use-route.ts";

// A bot's name, description, and face, with links to its other pages, and delete.
export function BotInfoScreen({ botId }: { botId: string }) {
  const bot = useBot(botId);
  if (bot === undefined) return <p className="p-6 text-muted-foreground">This bot no longer exists.</p>;
  return (
    <Page title={bot.name} subtitle="Bot info" back={chatHref(bot.id)}>
      <FacePicker bot={bot} />
      <NameForm key={`${bot.name}\n${bot.description}`} bot={bot} />
      <ModelDefault bot={bot} />
      <LinkRow href={memoryHref(bot.id)} title="Memory" detail="The four files this bot loads" />
      <LinkRow href={notesHref(bot.id)} title="Notes" detail="Longer records this bot keeps" />
      <LinkRow href={botSettingsHref(bot.id)} title="Bot settings" detail="Permissions, approval wait, network" />
      <DeleteBot bot={bot} />
    </Page>
  );
}

// The bot's default model and reasoning effort, which opens the picker for them.
function ModelDefault({ bot }: { bot: Bot }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-left text-sm hover:bg-accent">
        <span>
          <span className="block font-semibold">Model default</span>
          <span className="block text-xs text-muted-foreground">Used by chats that haven't picked their own</span>
        </span>
        <span className="text-muted-foreground">{modelDefaultLabel(bot)} ▾</span>
      </button>
      {open ? <ModelPicker bot={bot} onClose={() => setOpen(false)} className="w-full" /> : null}
    </div>
  );
}

function FacePicker({ bot }: { bot: Bot }) {
  const client = useBotsmanClient();
  const input = useRef<HTMLInputElement>(null);
  const save = useAction((avatar: AvatarValue | null) => client.updateBot(bot.id, { avatar }));
  const upload = useAction(async (file: File) => client.updateBot(bot.id, { avatar: photoAvatar(await shrinkPhoto(file)) }));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <Avatar bot={bot} size={96} />
        <div className="flex flex-col gap-2">
          <Button variant="primary" disabled={upload.busy} onClick={() => input.current?.click()}>
            Upload a photo
          </Button>
          {bot.avatar === null ? null : (
            <Button variant="text" onClick={() => void save.run(null)}>
              Use the initial
            </Button>
          )}
        </div>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => event.target.files?.[0] && void upload.run(event.target.files[0])} />
      </div>
      <p className="text-xs text-muted-foreground">Or choose</p>
      <div className="flex flex-wrap gap-2">
        {MARK_IDS.map((mark) => {
          const chosen = bot.avatar?.kind === "mark" && bot.avatar.mark === mark;
          return (
            <button key={mark} type="button" aria-label={mark} aria-pressed={chosen} onClick={() => void save.run({ kind: "mark", mark })} className={`flex size-11 items-center justify-center rounded-lg border ${chosen ? "border-primary text-primary" : "border-border"} hover:bg-accent`}>
              <MarkIcon paths={MARKS[mark]!} size={22} />
            </button>
          );
        })}
      </div>
      <ErrorText>{save.error ?? upload.error}</ErrorText>
    </div>
  );
}

function NameForm({ bot }: { bot: Bot }) {
  const client = useBotsmanClient();
  const [name, setName] = useState(bot.name);
  const [description, setDescription] = useState(bot.description);
  const problem = botNameProblem(name);
  const changed = name.trim() !== bot.name || description.trim() !== bot.description;
  const save = useAction(() => client.updateBot(bot.id, { name: name.trim(), description: description.trim() }));
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void save.run();
      }}
    >
      <Field label="Name" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} />
      <Field label="Description" value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} />
      <ErrorText>{changed ? (problem ?? save.error) : save.error}</ErrorText>
      {changed ? (
        <Button type="submit" variant="primary" className="self-start" disabled={problem !== undefined || save.busy}>
          Save
        </Button>
      ) : null}
    </form>
  );
}

function DeleteBot({ bot }: { bot: Bot }) {
  const client = useBotsmanClient();
  const [asking, setAsking] = useState(false);
  const remove = useAction(async () => {
    await client.deleteBot(bot.id);
    window.location.hash = "";
  });
  if (bot.isMain) return <p className="text-xs text-muted-foreground">The main bot can't be deleted.</p>;
  if (!asking)
    return (
      <Button variant="danger" className="self-start" onClick={() => setAsking(true)}>
        Delete bot
      </Button>
    );
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-destructive p-3 text-sm">
      <p>Delete {bot.name}? It leaves the apps, and its data stays on the server. The main bot can restore it.</p>
      <ErrorText>{remove.error}</ErrorText>
      <div className="flex gap-2">
        <Button variant="danger" disabled={remove.busy} onClick={() => void remove.run()}>
          Delete
        </Button>
        <Button variant="text" onClick={() => setAsking(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

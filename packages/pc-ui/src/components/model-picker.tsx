import { type ChatController, effortChoices, shownEffort, effortLabel, modelLabel, type PickerScope, pickerValue, sameModel } from "@botsman/client-core";
import { useAction, useBotsmanClient, useModels } from "@botsman/client-core/react";
import type { Bot, ChatSettings, ModelRef, ThinkingLevel } from "@botsman/protocol";
import { useState } from "react";
import { ErrorText } from "./page.tsx";

const POPOVER = "absolute top-full left-4 z-10 mt-2 w-80";

// Picks the model and reasoning effort for the open chat, or for the bot's default. Without a chat, such as on bot
// info, it changes only the bot's default.
export function ModelPicker({ chat, bot, onClose, className = POPOVER }: { chat?: { controller: ChatController; settings: ChatSettings }; bot: Bot; onClose: () => void; className?: string }) {
  const client = useBotsmanClient();
  const { models, loading } = useModels();
  const [scope, setScope] = useState<PickerScope>(chat === undefined ? "bot" : "chat");
  const value = pickerValue(scope, chat?.settings ?? { model: bot.defaultModel, thinkingLevel: bot.thinkingLevel }, bot);
  const save = useAction((change: { model?: ModelRef | null; thinkingLevel?: ThinkingLevel }) =>
    scope === "chat" && chat !== undefined ? chat.controller.changeSettings(change) : client.updateBot(bot.id, { defaultModel: change.model, thinkingLevel: change.thinkingLevel }),
  );
  const current = models.find((model) => sameModel(model, value.model));
  return (
    <div role="dialog" aria-label="Model and reasoning" className={`flex flex-col gap-3 rounded-xl border border-border bg-card p-3 text-sm ${className}`}>
      {chat === undefined ? null : <div role="radiogroup" aria-label="Applies to" className="flex rounded-lg border border-border p-0.5">
        {(["chat", "bot"] as const).map((option) => (
          <button key={option} type="button" role="radio" aria-checked={option === scope} onClick={() => setScope(option)} className={`flex-1 rounded-md px-2 py-1 font-semibold ${option === scope ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
            {option === "chat" ? "This chat" : "Bot default"}
          </button>
        ))}
      </div>}
      <p className="text-xs text-muted-foreground">{value.note}</p>
      <h4 className="font-semibold">Model</h4>
      {loading ? <p className="text-muted-foreground">Loading…</p> : null}
      <div className="flex max-h-56 flex-col overflow-y-auto">
        {models.map((model) => (
          <Choice key={`${model.provider}/${model.id}`} label={modelLabel(model)} chosen={sameModel(model, value.model)} onPick={() => void save.run({ model: { provider: model.provider, modelId: model.id } })} />
        ))}
      </div>
      <h4 className="font-semibold">Reasoning effort</h4>
      <div className="flex flex-wrap gap-1">
        {effortChoices(current).map((level) => (
          <button key={level} type="button" aria-pressed={level === shownEffort(current, value.thinkingLevel)} onClick={() => void save.run({ thinkingLevel: level })} className={`rounded-md border px-2 py-1 text-xs ${level === shownEffort(current, value.thinkingLevel) ? "border-primary text-primary" : "border-border hover:bg-accent"}`}>
            {effortLabel(level)}
          </button>
        ))}
      </div>
      <ErrorText>{save.error}</ErrorText>
      <div className="flex justify-between">
        <a href="#/providers" className="text-primary underline" onClick={onClose}>
          Connect a provider
        </a>
        <button type="button" className="text-muted-foreground hover:text-foreground" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

function Choice({ label, chosen, onPick }: { label: string; chosen: boolean; onPick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={chosen} onClick={onPick} className={`rounded-md px-2 py-1.5 text-left hover:bg-accent ${chosen ? "text-primary" : ""}`}>
      {chosen ? "● " : "○ "}
      {label}
    </button>
  );
}

import type { Bot, ChatController, ChatSettings } from "@botsman/client-core";
import { useModelPicker } from "@botsman/client-core/react";
import { ErrorText, Segmented } from "./page.tsx";

const POPOVER = "absolute top-full left-4 z-10 mt-2 w-80";

// Picks the model and reasoning effort for the open chat, or for the bot's default. Without a chat, such as on bot
// info, it changes only the bot's default.
export function ModelPicker({ chat, bot, onClose, className = POPOVER }: { chat?: { controller: ChatController; settings: ChatSettings }; bot: Bot; onClose: () => void; className?: string }) {
  const picker = useModelPicker(bot, chat);
  return (
    <div role="dialog" aria-label="Model and reasoning" className={`flex flex-col gap-3 rounded-xl border border-border bg-card p-3 text-sm ${className}`}>
      {picker.scopes === undefined ? null : <Segmented label="Applies to" options={picker.scopes} value={picker.scope} onChange={picker.setScope} compact />}
      <p className="text-xs text-muted-foreground">{picker.note}</p>
      <h4 className="font-semibold">Model</h4>
      {picker.loading ? <p className="text-muted-foreground">Loading…</p> : null}
      <div className="flex max-h-56 flex-col overflow-y-auto">
        {picker.models.map((model) => (
          <Choice key={model.key} label={model.label} chosen={model.chosen} onPick={() => picker.pickModel(model.ref)} />
        ))}
      </div>
      <h4 className="font-semibold">Reasoning effort</h4>
      <div className="flex flex-wrap gap-1">
        {picker.efforts.map(({ level, label, chosen }) => (
          <button key={level} type="button" aria-pressed={chosen} onClick={() => picker.pickEffort(level)} className={`rounded-md border px-2 py-1 text-xs ${chosen ? "border-primary text-primary" : "border-border hover:bg-accent"}`}>
            {label}
          </button>
        ))}
      </div>
      <ErrorText>{picker.error}</ErrorText>
      <a href="#/providers" className="text-primary underline" onClick={onClose}>
        Connect a provider
      </a>
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

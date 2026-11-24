import type { Bot, ChatSettings, ModelRef, ThinkingLevel } from "@botsman/protocol";
import { useState } from "react";
import { modelChoices, sameModel } from "../bot-settings.ts";
import type { ChatController } from "../chat-controller.ts";
import { effortLabel } from "../format.ts";
import { effortChoices, PICKER_SCOPES, type PickerScope, pickerValue, shownEffort } from "../providers.ts";
import { useBotsmanClient } from "./client-context.tsx";
import { useAction } from "./use-action.ts";
import { useModels } from "./use-models.ts";

// The model and reasoning picker, for an open chat or for the bot's default. Without a chat it changes only the bot's
// default, so `scopes` is undefined and there is nothing to switch.
export function useModelPicker(bot: Bot, chat: { controller: ChatController; settings: ChatSettings } | undefined) {
  const client = useBotsmanClient();
  const { models, loading } = useModels();
  const [scope, setScope] = useState<PickerScope>(chat === undefined ? "bot" : "chat");
  const value = pickerValue(scope, chat?.settings ?? { model: bot.defaultModel, thinkingLevel: bot.thinkingLevel }, bot);
  const save = useAction((change: { model?: ModelRef; thinkingLevel?: ThinkingLevel }) =>
    scope === "chat" && chat !== undefined ? chat.controller.changeSettings(change) : client.updateBot(bot.id, { defaultModel: change.model, thinkingLevel: change.thinkingLevel }),
  );
  const current = models.find((model) => sameModel(model, value.model));
  const effort = shownEffort(current, value.thinkingLevel);
  return {
    scopes: chat === undefined ? undefined : PICKER_SCOPES,
    scope,
    setScope,
    note: value.note,
    loading,
    models: modelChoices(models, value.model),
    efforts: effortChoices(current).map((level) => ({ level, label: effortLabel(level), chosen: level === effort })),
    pickModel: (model: ModelRef) => void save.run({ model }),
    pickEffort: (thinkingLevel: ThinkingLevel) => void save.run({ thinkingLevel }),
    error: save.error,
  };
}

import type { Bot, ChatSettings, LoginStep, ModelInfo, ModelRef, ProviderLogin, ThinkingLevel } from "@botsman/protocol";
import { ThinkingLevels } from "@botsman/protocol";

type Prompt = Extract<LoginStep, { type: "prompt" }>;

// What a sign-in screen shows: the address to open, a code to enter there, the question waiting for an answer,
// the latest progress line, and how it ended.
export type LoginView = {
  link: { url: string; instructions: string | null } | undefined;
  code: { userCode: string; verificationUri: string } | undefined;
  prompt: Prompt | undefined;
  progress: string | undefined;
  outcome: "running" | "connected" | "failed" | "cancelled";
  error: string | undefined;
};

export function loginView(login: ProviderLogin): LoginView {
  const latest = <T extends LoginStep["type"]>(type: T) => login.steps.findLast((step): step is Extract<LoginStep, { type: T }> => step.type === type);
  const prompt = login.steps.find((step): step is Prompt => step.type === "prompt" && step.promptId === login.pendingPrompt);
  const link = latest("auth_url");
  const code = latest("device_code");
  const progress = login.steps.findLast((step) => step.type === "progress" || step.type === "info") as { message: string } | undefined;
  return {
    link: link === undefined ? undefined : { url: link.url, instructions: link.instructions },
    code: code === undefined ? undefined : { userCode: code.userCode, verificationUri: code.verificationUri },
    prompt,
    progress: progress?.message,
    outcome: login.status === "succeeded" ? "connected" : login.status,
    error: login.error ?? undefined,
  };
}

// A provider's status line in the list.
export function providerStatus(connected: boolean, connectedWith: "api_key" | "oauth" | null): string {
  if (!connected) return "Not connected";
  return connectedWith === "oauth" ? "Connected with a sign-in" : "Connected with an API key";
}

// The reasoning levels a model offers, from Pi's catalog on the server. Servers older than that list send only whether
// the model reasons.
export function effortChoices(model: ModelInfo | undefined): readonly ThinkingLevel[] {
  if (model?.thinkingLevels !== undefined) return model.thinkingLevels;
  return model === undefined || model.reasoning ? ThinkingLevels.filter((level) => level !== "max") : ["off"];
}

// Why a chat can't run, from the connected models and the chat's model, or undefined when it can.
export function modelProblem(models: readonly ModelInfo[], model: ModelRef | null): string | undefined {
  if (models.length === 0) return "Connect a model provider to start chatting.";
  if (model === null) return "Choose a model for this chat.";
  const found = models.some((candidate) => candidate.provider === model.provider && candidate.id === model.modelId);
  return found ? undefined : `${model.modelId} isn't available. Connect its provider or choose another model.`;
}

export type PickerScope = "chat" | "bot";

// What the picker changes in each scope, and the line that explains it.
export function pickerValue(scope: PickerScope, chat: ChatSettings, bot: Pick<Bot, "name" | "defaultModel" | "thinkingLevel">): { model: ModelRef | null; thinkingLevel: ThinkingLevel; note: string } {
  if (scope === "bot") return { model: bot.defaultModel, thinkingLevel: bot.thinkingLevel, note: `This changes ${bot.name} everywhere a chat hasn't picked its own.` };
  return { model: chat.model, thinkingLevel: chat.thinkingLevel, note: "This changes only the open chat." };
}

// The level a chat really runs at. A level the model lacks moves to the next one up it has, else the next one down,
// as Pi does when it sends the request.
export function shownEffort(model: ModelInfo | undefined, level: ThinkingLevel): ThinkingLevel {
  const choices = effortChoices(model);
  if (choices.includes(level)) return level;
  const wanted = ThinkingLevels.indexOf(level);
  const higher = ThinkingLevels.slice(wanted + 1).find((candidate) => choices.includes(candidate));
  const lower = ThinkingLevels.slice(0, wanted).reverse().find((candidate) => choices.includes(candidate));
  return higher ?? lower ?? choices[0] ?? "off";
}

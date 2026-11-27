import { type Avatar, type Bot, BOT_NAME_PATTERN, BotLimits, type ModelInfo, type ModelRef, type PermissionMode } from "@botsman/protocol";
import { effortLabel } from "./format.ts";

// What each permission mode does, as bot settings explains it. Smart says it runs like Off until the classifier exists.
export const PERMISSION_MODES: readonly { mode: PermissionMode; label: string; note: string }[] = [
  { mode: "manual", label: "Manual", note: "Anything that leaves this bot's folder asks you." },
  { mode: "smart", label: "Smart", note: "Smart currently runs like Off: actions outside this bot's folder run without asking. A classifier will decide them later." },
  { mode: "off", label: "Off", note: "Actions outside this bot's folder run without asking." },
];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

// The line under a bot's permission mode. Memory edits ask whatever the mode.
export function permissionNote(mode: PermissionMode): string {
  const chosen = PERMISSION_MODES.find((option) => option.mode === mode)!;
  return `${chosen.note} Memory edits always ask, in every mode.`;
}

// How long an approval waits before it is refused. The server accepts one minute to seven days.
const APPROVAL_WAITS: readonly { label: string; ms: number }[] = [
  { label: "15 minutes", ms: 15 * MINUTE },
  { label: "1 hour", ms: HOUR },
  { label: "8 hours", ms: 8 * HOUR },
  { label: "1 day", ms: 24 * HOUR },
  { label: "7 days", ms: 7 * 24 * HOUR },
];

// A wait as words, including one set outside the usual choices.
export function approvalWaitLabel(ms: number): string {
  const known = APPROVAL_WAITS.find((wait) => wait.ms === ms);
  if (known !== undefined) return known.label;
  return ms < HOUR ? `${Math.round(ms / MINUTE)} minutes` : `${Math.round(ms / HOUR)} hours`;
}

// The waits to choose from, with the bot's own first when it is outside the usual ones.
export function approvalWaitChoices(current: number): { label: string; ms: number; chosen: boolean }[] {
  const usual = APPROVAL_WAITS.map((wait) => ({ ...wait, chosen: wait.ms === current }));
  return usual.some((wait) => wait.chosen) ? usual : [{ label: approvalWaitLabel(current), ms: current, chosen: true }, ...usual];
}

// Why a name can't be saved, or undefined when it can. The server refuses slashes, backslashes, and control characters.
export function botNameProblem(name: string): string | undefined {
  const trimmed = name.trim();
  if (trimmed === "") return "Give the bot a name.";
  if (trimmed.length > BotLimits.name) return `Keep the name to ${BotLimits.name} characters.`;
  if (!new RegExp(BOT_NAME_PATTERN).test(trimmed)) return "A name can't contain slashes or control characters.";
  return undefined;
}

// The square and the JPEG quality apps shrink a picked photo to, well under the largest photo the server stores.
export const PHOTO_SIZE = 256;
export const PHOTO_QUALITY = 0.85;

// A picked photo as an avatar, or an error when it is still too large after shrinking.
export function photoAvatar(dataUrl: string): Avatar {
  if (dataUrl.length > BotLimits.photo) throw new Error("That photo is too large. Try another.");
  return { kind: "photo", dataUrl };
}

// What a bot's picture shows when it has no photo or mark.
export function botInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

// The model a new bot starts with: the main bot's default when it is still connected, else the first connected model.
export function suggestedModel(models: readonly ModelInfo[], mainDefault: ModelRef | null | undefined): ModelRef | null {
  const main = models.find((model) => sameModel(model, mainDefault ?? null));
  const pick = main ?? models[0];
  return pick === undefined ? null : modelRef(pick);
}

// A model as a picker lists it, marked when it is the one in use.
export type ModelChoice = { key: string; label: string; chosen: boolean; ref: ModelRef };

export function modelChoices(models: readonly ModelInfo[], current: ModelRef | null): ModelChoice[] {
  return models.map((model) => ({
    key: `${model.provider}/${model.id}`,
    label: `${model.name} · ${model.provider}`,
    chosen: sameModel(model, current),
    ref: modelRef(model),
  }));
}

function modelRef(model: ModelInfo): ModelRef {
  return { provider: model.provider, modelId: model.id };
}

export function sameModel(model: ModelInfo, ref: ModelRef | null): boolean {
  return ref !== null && model.provider === ref.provider && model.id === ref.modelId;
}

// A bot's default model and effort, as bot info's Model default row shows it.
export function modelDefaultLabel(bot: Pick<Bot, "defaultModel" | "thinkingLevel">): string {
  return bot.defaultModel === null ? "None" : `${bot.defaultModel.modelId} · ${effortLabel(bot.thinkingLevel)}`;
}

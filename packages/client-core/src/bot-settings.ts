import type { Avatar, ModelInfo, ModelRef, PermissionMode } from "@botsman/protocol";

// What each permission mode does, as bot settings explains it. Smart says it runs like Off until the classifier exists.
export const PERMISSION_MODES: readonly { mode: PermissionMode; label: string; note: string }[] = [
  { mode: "manual", label: "Manual", note: "Anything that leaves this bot's folder asks you." },
  { mode: "smart", label: "Smart", note: "Smart currently runs like Off: actions outside this bot's folder run without asking. A classifier will decide them later." },
  { mode: "off", label: "Off", note: "Actions outside this bot's folder run without asking." },
];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

// How long an approval waits before it is refused. The server accepts one minute to seven days.
export const APPROVAL_WAITS: readonly { label: string; ms: number }[] = [
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

// Why a name can't be saved, or undefined when it can. The server refuses slashes, backslashes, and control characters.
export function botNameProblem(name: string): string | undefined {
  const trimmed = name.trim();
  if (trimmed === "") return "Give the bot a name.";
  if (trimmed.length > 60) return "Keep the name to 60 characters.";
  if (/[/\\\u0000-\u001f]/.test(trimmed)) return "A name can't contain slashes or control characters.";
  return undefined;
}

// The largest photo the server stores, as a data URL. Apps shrink a picked photo to fit well under this.
export const PHOTO_LIMIT = 400_000;
export const PHOTO_SIZE = 256;

// A picked photo as an avatar, or an error when it is still too large after shrinking.
export function photoAvatar(dataUrl: string): Avatar {
  if (dataUrl.length > PHOTO_LIMIT) throw new Error("That photo is too large. Try another.");
  return { kind: "photo", dataUrl };
}

// The model a new bot starts with: the main bot's default when it is still connected, else the first connected model.
export function suggestedModel(models: readonly ModelInfo[], mainDefault: ModelRef | null | undefined): ModelRef | null {
  const main = models.find((model) => model.provider === mainDefault?.provider && model.id === mainDefault?.modelId);
  const pick = main ?? models[0];
  return pick === undefined ? null : { provider: pick.provider, modelId: pick.id };
}

// A model as a picker lists it.
export function modelLabel(model: ModelInfo): string {
  return `${model.name} · ${model.provider}`;
}

export function sameModel(model: ModelInfo, ref: ModelRef | null): boolean {
  return ref !== null && model.provider === ref.provider && model.id === ref.modelId;
}

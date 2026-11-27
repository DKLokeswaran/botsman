import { arr, bool, int, map, nullable, obj, oneOf, opt, type Static, str, union, lit } from "@earendil-works/pi-schema";

export const PermissionModes = ["manual", "smart", "off"] as const;
export const PermissionMode = oneOf(PermissionModes);
export type PermissionMode = Static<typeof PermissionMode>;

// Pi's reasoning levels, lowest first. Each model supports some of them; see ModelInfo.thinkingLevels.
export const ThinkingLevels = ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const;
export const ThinkingLevel = oneOf(ThinkingLevels);
export type ThinkingLevel = Static<typeof ThinkingLevel>;

export const ModelRef = obj({
  provider: str({ minLength: 1 }),
  modelId: str({ minLength: 1 }),
});
export type ModelRef = Static<typeof ModelRef>;

// The most characters each field the owner fills in for a bot may have. `photo` counts the photo's data URL.
export const BotLimits = { name: 60, description: 500, purpose: 6000, photo: 400_000 } as const;

// A bot's picture: one of the built-in marks, or an uploaded photo as a data URL.
export const Avatar = union([
  obj({ kind: lit("mark"), mark: str({ minLength: 1, maxLength: 64 }) }),
  obj({ kind: lit("photo"), dataUrl: str({ pattern: "^data:image/(png|jpeg|webp);base64,", maxLength: BotLimits.photo }) }),
]);
export type Avatar = Static<typeof Avatar>;

export const Bot = obj({
  id: str(),
  name: str(),
  description: str(),
  isMain: bool(),
  avatar: nullable(Avatar),
  defaultModel: nullable(ModelRef),
  thinkingLevel: ThinkingLevel,
  folder: str(),
  permissionMode: PermissionMode,
  approvalWaitMs: int(),
  network: bool(),
  connections: map(bool()),
  skills: map(bool()),
  createdAt: int(),
  updatedAt: int(),
});
export type Bot = Static<typeof Bot>;

export const BotList = obj({ bots: arr(Bot) });
export type BotList = Static<typeof BotList>;

// A bot name holds no slashes, backslashes, or control characters.
export const BOT_NAME_PATTERN = "^[^/\\\\\\u0000-\\u001f]+$";
export const BotName = str({ minLength: 1, maxLength: BotLimits.name, pattern: BOT_NAME_PATTERN });

// What the owner fills in when creating a bot. `purpose` seeds BOT_PROFILE.md; an empty folder means the default.
export const BotCreate = obj({
  name: BotName,
  description: opt(str({ maxLength: BotLimits.description })),
  purpose: opt(str({ maxLength: BotLimits.purpose })),
  defaultModel: opt(nullable(ModelRef)),
  folder: opt(str({ maxLength: 4096 })),
});
export type BotCreate = Static<typeof BotCreate>;

export const BotUpdate = obj({
  name: opt(BotName),
  description: opt(str({ maxLength: BotLimits.description })),
  avatar: opt(nullable(Avatar)),
  defaultModel: opt(nullable(ModelRef)),
  thinkingLevel: opt(ThinkingLevel),
  permissionMode: opt(PermissionMode),
  approvalWaitMs: opt(int({ minimum: 60_000, maximum: 7 * 24 * 3_600_000 })),
  network: opt(bool()),
  connections: opt(map(bool())),
  skills: opt(map(bool())),
});
export type BotUpdate = Static<typeof BotUpdate>;

export const FreeSpaceQuery = obj({ path: opt(str({ maxLength: 4096 })) });
export type FreeSpaceQuery = Static<typeof FreeSpaceQuery>;

// Free space on the disk that would hold a folder, and whether the server accepts that folder.
export const FreeSpace = obj({
  path: str(),
  freeBytes: int(),
  totalBytes: int(),
  allowed: bool(),
  reason: opt(str()),
});
export type FreeSpace = Static<typeof FreeSpace>;

// What the bot list shows under each bot: when its chat last moved, the newest message, and replies the owner hasn't seen.
// `lastAt` is null for a chat with no timed messages yet. `preview` is empty for an empty chat.
export const BotActivity = obj({
  botId: str(),
  lastAt: nullable(int()),
  preview: str(),
  unread: int({ minimum: 0 }),
  // Whether the bot is replying or using tools right now. Missing from servers older than this field.
  working: opt(bool()),
});
export type BotActivity = Static<typeof BotActivity>;

// Marks a chat read up to the time of the newest message the owner has seen, on every device.
export const MarkRead = obj({ upTo: int({ minimum: 0 }) });
export type MarkRead = Static<typeof MarkRead>;

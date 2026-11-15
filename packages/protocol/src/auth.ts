import { arr, bool, int, nullable, obj, opt, type Static, str } from "@earendil-works/pi-schema";
import { BotCreate } from "./bots.ts";

export const SetupStatus = obj({ needsSetup: bool() });
export type SetupStatus = Static<typeof SetupStatus>;

// First-run setup: the owner's password and the main bot.
export const SetupRequest = obj({
  password: str({ minLength: 12, maxLength: 1024 }),
  deviceName: str({ minLength: 1, maxLength: 100 }),
  mainBot: BotCreate,
});
export type SetupRequest = Static<typeof SetupRequest>;

export const LoginRequest = obj({
  password: str({ minLength: 1, maxLength: 1024 }),
  deviceName: str({ minLength: 1, maxLength: 100 }),
});
export type LoginRequest = Static<typeof LoginRequest>;

export const RefreshRequest = obj({ refreshToken: str({ minLength: 1 }) });
export type RefreshRequest = Static<typeof RefreshRequest>;

export const Tokens = obj({
  accessToken: str(),
  accessExpiresAt: int(),
  refreshToken: str(),
  refreshExpiresAt: int(),
  sessionId: str(),
});
export type Tokens = Static<typeof Tokens>;

// One signed-in device, which the owner can revoke.
export const DeviceSession = obj({
  id: str(),
  deviceName: str(),
  createdAt: int(),
  lastUsedAt: int(),
  expiresAt: int(),
  revokedAt: nullable(int()),
  current: opt(bool()),
});
export type DeviceSession = Static<typeof DeviceSession>;

export const DeviceSessionList = obj({ sessions: arr(DeviceSession) });
export type DeviceSessionList = Static<typeof DeviceSessionList>;

import { arr, bool, int, nullable, obj, opt, type Static, str } from "@earendil-works/pi-schema";
import { BotCreate } from "./bots.ts";

export const SetupStatus = obj({ needsSetup: bool() });
export type SetupStatus = Static<typeof SetupStatus>;

// First-run setup: the owner's password and the main bot. `cookie` asks for the session in cookies, as the web
// dashboard does, and the reply is then a SessionInfo.
export const SetupRequest = obj({
  password: str({ minLength: 12, maxLength: 1024 }),
  deviceName: str({ minLength: 1, maxLength: 100 }),
  mainBot: BotCreate,
  cookie: opt(bool()),
});
export type SetupRequest = Static<typeof SetupRequest>;

export const LoginRequest = obj({
  password: str({ minLength: 1, maxLength: 1024 }),
  deviceName: str({ minLength: 1, maxLength: 100 }),
  cookie: opt(bool()),
});
export type LoginRequest = Static<typeof LoginRequest>;

// Without a refresh token in the body, the server reads it from the dashboard's cookie.
export const RefreshRequest = obj({ refreshToken: opt(str({ minLength: 1 })) });
export type RefreshRequest = Static<typeof RefreshRequest>;

export const Tokens = obj({
  accessToken: str(),
  accessExpiresAt: int(),
  refreshToken: str(),
  refreshExpiresAt: int(),
  sessionId: str(),
});
export type Tokens = Static<typeof Tokens>;

// A session whose tokens live in cookies, so the page only learns when they run out.
export const SessionInfo = obj({
  sessionId: str(),
  accessExpiresAt: int(),
  refreshExpiresAt: int(),
});
export type SessionInfo = Static<typeof SessionInfo>;

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

// A token that opens only the alerts stream, for the phone's background connection. It lasts while the device stays signed in.
export const AlertsToken = obj({ token: str() });
export type AlertsToken = Static<typeof AlertsToken>;

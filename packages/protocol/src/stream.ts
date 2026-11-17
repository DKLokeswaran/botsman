import { int, lit, obj, opt, type Static, str, union } from "@earendil-works/pi-schema";
import type { AlertSettings } from "./alerts.ts";
import type { Approval } from "./approvals.ts";
import type { Bot, BotActivity } from "./bots.ts";
import type { ChatEvent, ChatSnapshot } from "./chat.ts";
import type { ProviderLogin } from "./providers.ts";

// Stream names: `chat:<botId>` for one bot's chat, `server` for approvals, bots, and sign-ins.
export const SERVER_STREAM = "server";
export function chatStream(botId: string): string {
  return `chat:${botId}`;
}
export function botIdOfStream(stream: string): string | undefined {
  return stream.startsWith("chat:") ? stream.slice(5) : undefined;
}

// Where a client left off: the server's epoch and the last sequence number it saw on that stream.
export const StreamPosition = obj({ epoch: str(), seq: int({ minimum: 0 }) });
export type StreamPosition = Static<typeof StreamPosition>;

export const ClientMessage = union([
  obj({ type: lit("hello"), token: str() }),
  obj({ type: lit("subscribe"), stream: str({ minLength: 1 }), since: opt(StreamPosition) }),
  obj({ type: lit("unsubscribe"), stream: str({ minLength: 1 }) }),
  obj({ type: lit("ping") }),
]);
export type ClientMessage = Static<typeof ClientMessage>;

export type ServerEvent =
  | { type: "approval"; approval: Approval }
  | { type: "bot"; bot: Bot }
  | { type: "bot_deleted"; botId: string }
  | { type: "activity"; activity: BotActivity }
  | { type: "alert_settings"; settings: AlertSettings }
  | { type: "login"; login: ProviderLogin }
  | { type: "providers_changed" };

export type ServerSnapshot = {
  bots: Bot[];
  approvals: Approval[];
  // Missing from servers older than the bot list's activity line; additions like this don't raise the protocol number.
  activity?: BotActivity[];
  // Missing from servers older than alert settings.
  alertSettings?: AlertSettings;
};

export type StreamEvent = ChatEvent | ServerEvent;

export type ServerMessage =
  | { type: "ready"; epoch: string }
  | { type: "event"; stream: string; epoch: string; seq: number; event: StreamEvent }
  | { type: "catchup"; stream: string; epoch: string; events: { seq: number; event: StreamEvent }[] }
  | { type: "snapshot"; stream: string; epoch: string; seq: number; snapshot: ChatSnapshot | ServerSnapshot }
  | { type: "error"; error: string; message: string; stream?: string }
  | { type: "pong" };

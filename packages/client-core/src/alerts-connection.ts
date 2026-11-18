import type { Alert, AlertsServerMessage, Bot } from "@botsman/protocol";
import type { SocketLike } from "./stream-connection.ts";

const FIRST_RETRY_MS = 1_000;
const LONGEST_RETRY_MS = 30_000;
const PING_EVERY_MS = 25_000;

export type AlertsConnectionOptions = {
  url: string;
  createSocket: (url: string) => SocketLike;
  token: () => Promise<string>;
  onAlert: (alert: Alert) => void;
};

// Follows the alerts stream while an app is open. After a drop it sends where it left off, so missed alerts arrive
// once; a reset means they can't, and the app's other screens already show what waits.
export class AlertsConnection {
  readonly #options: AlertsConnectionOptions;
  #position = { epoch: "", seq: 0 };
  #socket: SocketLike | undefined;
  #running = false;
  #retryMs = FIRST_RETRY_MS;
  #retryTimer: ReturnType<typeof setTimeout> | undefined;
  #pingTimer: ReturnType<typeof setInterval> | undefined;

  constructor(options: AlertsConnectionOptions) {
    this.#options = options;
  }

  start(): void {
    if (this.#running) return;
    this.#running = true;
    void this.#connect();
  }

  stop(): void {
    this.#running = false;
    clearTimeout(this.#retryTimer);
    this.#drop();
  }

  async #connect(): Promise<void> {
    const token = await this.#options.token().catch(() => undefined);
    if (!this.#running) return;
    if (token === undefined) return this.#retry();
    const socket = this.#options.createSocket(this.#options.url);
    this.#socket = socket;
    socket.onopen = () => socket.send(JSON.stringify({ type: "hello", token, ...this.#position }));
    socket.onmessage = (event: { data: unknown }) => this.#receive(JSON.parse(String(event.data)) as AlertsServerMessage);
    socket.onclose = () => this.#socket === socket && this.#retry();
    socket.onerror = () => socket.close();
    this.#pingTimer = setInterval(() => socket.send(JSON.stringify({ type: "ping" })), PING_EVERY_MS);
  }

  #receive(message: AlertsServerMessage): void {
    if (message.type === "ready") this.#retryMs = FIRST_RETRY_MS;
    if (message.type === "alert" || message.type === "reset") {
      this.#retryMs = FIRST_RETRY_MS;
      this.#position = { epoch: message.epoch, seq: message.seq };
    }
    if (message.type === "alert") this.#options.onAlert(message.alert);
  }

  #retry(): void {
    this.#drop();
    if (!this.#running) return;
    this.#retryTimer = setTimeout(() => void this.#connect(), this.#retryMs);
    this.#retryMs = Math.min(this.#retryMs * 2, LONGEST_RETRY_MS);
  }

  #drop(): void {
    clearInterval(this.#pingTimer);
    const socket = this.#socket;
    this.#socket = undefined;
    socket?.close();
  }
}

// How a notification words each alert kind, with {bot} for the bot's name. Background connections get the same text.
export const ALERT_TEMPLATES: Record<Alert["kind"], string> = {
  approval: "{bot} needs your approval",
  question: "{bot} has a question",
  routine_result: "{bot} has a new routine result",
  failure: "{bot}'s reply failed",
  channel_mention: "{bot} mentioned you in a channel",
  routine_created: "{bot} created a routine",
  skill_created: "{bot} created a skill",
};

// How a notification words an alert, titled with the app's name.
export function alertText(appName: string, alert: Alert, bots: readonly Pick<Bot, "id" | "name">[]): { title: string; body: string } {
  const name = bots.find((bot) => bot.id === alert.botId)?.name ?? "A bot";
  return { title: appName, body: ALERT_TEMPLATES[alert.kind].replace("{bot}", name) };
}

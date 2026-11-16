import {
  type Approval,
  type ApprovalAnswer,
  type Bot,
  type BotCreate,
  type BotUpdate,
  type Health,
  type Ok,
  PROTOCOL_VERSION,
  type ProtocolFit,
  protocolFit,
  SERVER_STREAM,
  type ServerEvent,
  type ServerSnapshot,
} from "@botsman/protocol";
import { ApiClient, type Fetch } from "./api-client.ts";
import { ChatController } from "./chat-controller.ts";
import { applyServerEvent, applyServerSnapshot, emptyServerState, type ServerState } from "./server-state.ts";
import { Session, type TokenStore } from "./session.ts";
import { Store } from "./store.ts";
import { type SocketLike, StreamConnection, type StreamMessage } from "./stream-connection.ts";

export type BotsmanClientOptions = {
  baseUrl: string;
  fetch: Fetch;
  createSocket: (url: string) => SocketLike;
  deviceName: string;
  // Leave out on the web dashboard, whose session lives in cookies.
  tokenStore?: TokenStore;
  newRequestId?: () => string;
};

// Everything an app needs from one Botsman server: the session, the live connection, and the state screens show.
export class BotsmanClient {
  readonly session: Session;
  readonly connection: StreamConnection;
  readonly server = new Store<ServerState>(emptyServerState);
  readonly #api: ApiClient;
  readonly #chats = new Map<string, ChatController>();
  readonly #newRequestId: () => string;
  #stopServerStream: (() => void) | undefined;

  constructor(options: BotsmanClientOptions) {
    this.#api = new ApiClient({ baseUrl: options.baseUrl, fetch: options.fetch });
    this.session = new Session(options);
    this.#newRequestId = options.newRequestId ?? randomId;
    this.connection = new StreamConnection({
      url: `${this.#api.baseUrl.replace(/^http/, "ws")}/api/ws`,
      createSocket: options.createSocket,
      token: () => this.session.socketToken(),
      onUnauthorized: () => this.session.renew(),
    });
    this.session.state.subscribe(() => this.#followSession());
  }

  get baseUrl(): string {
    return this.#api.baseUrl;
  }

  health(): Promise<Health> {
    return this.#api.health();
  }

  // Whether this app and the server speak a protocol in common, and which side to update when they don't.
  async protocolFit(): Promise<ProtocolFit> {
    return protocolFit(PROTOCOL_VERSION, (await this.health()).protocol);
  }

  chat(botId: string): ChatController {
    const known = this.#chats.get(botId);
    if (known !== undefined) return known;
    const chat = new ChatController(botId, this.session, this.connection, this.#newRequestId);
    this.#chats.set(botId, chat);
    return chat;
  }

  createBot(bot: BotCreate): Promise<Bot> {
    return this.session.request("POST", "/api/bots", bot);
  }

  updateBot(botId: string, change: BotUpdate): Promise<Bot> {
    return this.session.request("PATCH", `/api/bots/${botId}`, change);
  }

  deleteBot(botId: string): Promise<Ok> {
    return this.session.request("DELETE", `/api/bots/${botId}`);
  }

  answerApproval(approvalId: string, decision: ApprovalAnswer["decision"]): Promise<Approval> {
    return this.session.request("POST", `/api/approvals/${approvalId}/answer`, { decision });
  }

  // The connection runs while the owner is signed in, and stops when they sign out.
  #followSession(): void {
    if (this.session.state.get().status === "signed_in") return this.#goOnline();
    this.#stopServerStream?.();
    this.#stopServerStream = undefined;
    this.connection.stop();
    this.server.set(emptyServerState);
  }

  #goOnline(): void {
    this.#stopServerStream ??= this.connection.subscribe(SERVER_STREAM, (message) => this.#receive(message));
    this.connection.start();
  }

  #receive(message: StreamMessage): void {
    if (message.type === "snapshot") return this.server.update((state) => applyServerSnapshot(state, message.snapshot as ServerSnapshot));
    const events = message.type === "catchup" ? message.events.map((item) => item.event) : [message.event];
    this.server.update((state) => events.reduce((next, event) => applyServerEvent(next, event as ServerEvent), state));
  }
}

// A request id only has to differ from the app's other recent sends, so a runtime without `crypto.randomUUID`,
// such as React Native's, makes one from the time and a random number.
function randomId(): string {
  const crypto = globalThis.crypto as { randomUUID?: () => string } | undefined;
  return crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

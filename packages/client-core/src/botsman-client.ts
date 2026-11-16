import {
  type AlertSettings,
  type AlertSettingsUpdate,
  type Approval,
  type ApprovalAnswer,
  type Bot,
  type BotCreate,
  type BotUpdate,
  type FreeSpace,
  type Health,
  type MemoryFile,
  type MemoryFileName,
  type MemoryFiles,
  type Note,
  type NoteInfo,
  type NoteList,
  type NoteSearchHit,
  type NoteSearchResult,
  type ModelInfo,
  type ModelList,
  type Ok,
  PROTOCOL_VERSION,
  type ProtocolFit,
  type Provider,
  type ProviderList,
  type ProviderLogin,
  protocolFit,
  SERVER_STREAM,
  type ServerEvent,
  type ServerSnapshot,
  type UsageReport,
} from "@botsman/protocol";
import { ApiClient, type Fetch } from "./api-client.ts";
import { ChatController } from "./chat-controller.ts";
import { applyServerEvent, applyServerSnapshot, emptyServerState, type ServerState, withLogin } from "./server-state.ts";
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

  memory(botId: string): Promise<MemoryFiles> {
    return this.session.request("GET", `/api/bots/${botId}/memory`);
  }

  // The owner's own edit to a memory file. Bots get the change with their next message.
  saveMemory(botId: string, file: MemoryFileName, content: string): Promise<MemoryFile> {
    return this.session.request("PUT", `/api/bots/${botId}/memory/${file}`, { content });
  }

  async notes(botId: string): Promise<NoteInfo[]> {
    return (await this.session.request<NoteList>("GET", `/api/bots/${botId}/notes`)).notes;
  }

  async searchNotes(botId: string, query: string): Promise<NoteSearchHit[]> {
    return (await this.session.request<NoteSearchResult>("GET", `/api/bots/${botId}/notes-search?q=${encodeURIComponent(query)}`)).hits;
  }

  note(botId: string, name: string): Promise<Note> {
    return this.session.request("GET", `/api/bots/${botId}/notes/${encodeURIComponent(name)}`);
  }

  // Saves a note, and removes the old file when the owner renamed it.
  async saveNote(botId: string, name: string, content: string, previousName?: string): Promise<Note> {
    const note = await this.session.request<Note>("PUT", `/api/bots/${botId}/notes/${encodeURIComponent(name)}`, { content });
    if (previousName !== undefined && previousName !== name) await this.deleteNote(botId, previousName);
    return note;
  }

  deleteNote(botId: string, name: string): Promise<Ok> {
    return this.session.request("DELETE", `/api/bots/${botId}/notes/${encodeURIComponent(name)}`);
  }

  async providers(): Promise<Provider[]> {
    return (await this.session.request<ProviderList>("GET", "/api/providers")).providers;
  }

  saveApiKey(providerId: string, key: string): Promise<Ok> {
    return this.session.request("PUT", `/api/providers/${providerId}/key`, { key });
  }

  disconnectProvider(providerId: string): Promise<Ok> {
    return this.session.request("DELETE", `/api/providers/${providerId}`);
  }

  // Starts a browser sign-in on the server. Its steps then arrive on the server stream.
  async startLogin(providerId: string): Promise<ProviderLogin> {
    return this.#keepLogin(await this.session.request<ProviderLogin>("POST", `/api/providers/${providerId}/login`));
  }

  // Later steps arrive on the server stream, which can be ahead of these answers, so they don't replace what it sent.
  answerLogin(loginId: string, promptId: string, value: string): Promise<ProviderLogin> {
    return this.session.request<ProviderLogin>("POST", `/api/provider-logins/${loginId}/answer`, { promptId, value });
  }

  cancelLogin(loginId: string): Promise<ProviderLogin> {
    return this.session.request<ProviderLogin>("POST", `/api/provider-logins/${loginId}/cancel`);
  }

  // Keeps a sign-in's first copy, unless the stream already brought a newer one.
  #keepLogin(login: ProviderLogin): ProviderLogin {
    this.server.update((state) => (state.logins[login.id] === undefined ? withLogin(state, login) : state));
    return login;
  }

  // Models from every connected provider.
  async models(): Promise<ModelInfo[]> {
    return (await this.session.request<ModelList>("GET", "/api/models")).models;
  }

  // Free space on the disk that would hold a folder, and whether the server accepts that folder. No path means the default.
  freeSpace(path: string): Promise<FreeSpace> {
    const query = path.trim() === "" ? "" : `?path=${encodeURIComponent(path.trim())}`;
    return this.session.request("GET", `/api/server/free-space${query}`);
  }

  // Spending over the last `days` days, by day and by bot, with days on this device's clock.
  usage(days: number): Promise<UsageReport> {
    return this.session.request("GET", `/api/usage?days=${days}&tzOffset=${new Date().getTimezoneOffset()}`);
  }

  // Turns alert kinds on or off for every device. The server stream brings the result to every open app.
  updateAlertSettings(change: AlertSettingsUpdate): Promise<AlertSettings> {
    return this.session.request("PATCH", "/api/settings/alerts", change);
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

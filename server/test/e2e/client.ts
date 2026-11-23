import { applyLivePatch, expectedHashes, hashesMatch } from "@botsman/client-core";
import type {
  Approval,
  Bot,
  BotCreate,
  BotUpdate,
  ChatEvent,
  ChatMessage,
  ChatSnapshot,
  LivePatch,
  LiveState,
  MemoryFiles,
  NoteSearchResult,
  SendMessageResponse,
  ServerMessage,
  StreamEvent,
  Tokens,
} from "@botsman/protocol";

// A protocol-only client for the server, standing in for the apps. It goes through HTTPS headers, auth, and the
// WebSocket exactly as an app would, using nothing but the `protocol` package.
export class BotsmanClient {
  readonly baseUrl: string;
  tokens: Tokens | undefined;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await this.raw(method, path, body);
    const text = await response.text();
    const data = text ? JSON.parse(text) : undefined;
    if (!response.ok) throw new HttpError(response.status, data);
    return data as T;
  }

  raw(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        // The test server sits behind no proxy, so the client says what Tailscale Serve or Caddy would.
        "x-forwarded-proto": "https",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(this.tokens ? { authorization: `Bearer ${this.tokens.accessToken}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async setup(password: string, mainBot: BotCreate): Promise<Tokens> {
    this.tokens = await this.request<Tokens>("POST", "/api/setup", { password, deviceName: "e2e", mainBot });
    return this.tokens;
  }

  async login(password: string): Promise<Tokens> {
    this.tokens = await this.request<Tokens>("POST", "/api/auth/login", { password, deviceName: "e2e" });
    return this.tokens;
  }

  createBot(bot: BotCreate): Promise<Bot> {
    return this.request("POST", "/api/bots", bot);
  }

  updateBot(id: string, change: BotUpdate): Promise<Bot> {
    return this.request("PATCH", `/api/bots/${id}`, change);
  }

  bots(): Promise<{ bots: Bot[] }> {
    return this.request("GET", "/api/bots");
  }

  send(botId: string, text: string, mode: "send" | "steer" | "queue" = "send"): Promise<SendMessageResponse> {
    return this.request("POST", `/api/bots/${botId}/chat/messages`, { text, mode });
  }

  stop(botId: string): Promise<unknown> {
    return this.request("POST", `/api/bots/${botId}/chat/stop`);
  }

  chat(botId: string): Promise<ChatSnapshot> {
    return this.request("GET", `/api/bots/${botId}/chat`);
  }

  approvals(status = "pending"): Promise<{ approvals: Approval[] }> {
    return this.request("GET", `/api/approvals?status=${status}`);
  }

  answerApproval(id: string, decision: "allow_once" | "allow_chat" | "deny"): Promise<Approval> {
    return this.request("POST", `/api/approvals/${id}/answer`, { decision });
  }

  memory(botId: string): Promise<MemoryFiles> {
    return this.request("GET", `/api/bots/${botId}/memory`);
  }

  searchNotes(botId: string, q: string): Promise<NoteSearchResult> {
    return this.request("GET", `/api/bots/${botId}/notes-search?q=${encodeURIComponent(q)}`);
  }

  saveKey(providerId: string, key: string): Promise<unknown> {
    return this.request("PUT", `/api/providers/${providerId}/key`, { key });
  }

  async stream(): Promise<StreamClient> {
    const socket = new StreamClient(`${this.baseUrl.replace(/^http/, "ws")}/api/ws`);
    await socket.open(this.tokens!.accessToken);
    return socket;
  }
}

export class HttpError extends Error {
  readonly status: number;
  readonly body: { error?: string; message?: string } | undefined;

  constructor(status: number, body: { error?: string; message?: string } | undefined) {
    super(`HTTP ${status}: ${body?.error ?? ""} ${body?.message ?? ""}`);
    this.status = status;
    this.body = body;
  }
}

type Waiter = { match: (message: ServerMessage) => boolean; resolve: (message: ServerMessage) => void };

// One WebSocket connection: keeps every message, follows each chat's messages and live state, and remembers the
// last sequence number per stream for catch-up.
export class StreamClient {
  readonly url: string;
  readonly received: ServerMessage[] = [];
  readonly positions = new Map<string, { epoch: string; seq: number }>();
  readonly messages = new Map<string, ChatMessage[]>();
  readonly live = new Map<string, LiveState>();
  #socket: WebSocket | undefined;
  #waiters: Waiter[] = [];

  constructor(url: string) {
    this.url = url;
  }

  async open(token: string): Promise<void> {
    const socket = new WebSocket(this.url, { headers: { "x-forwarded-proto": "https" } } as unknown as string[]);
    this.#socket = socket;
    socket.onmessage = (event) => this.#receive(JSON.parse(String(event.data)) as ServerMessage);
    await new Promise<void>((resolve, reject) => {
      socket.onopen = () => resolve();
      socket.onerror = () => reject(new Error("socket failed to open"));
    });
    socket.send(JSON.stringify({ type: "hello", token }));
    await this.waitFor((message) => message.type === "ready");
  }

  subscribe(stream: string, resume = false): void {
    const since = resume ? this.positions.get(stream) : undefined;
    this.#socket!.send(JSON.stringify({ type: "subscribe", stream, ...(since ? { since } : {}) }));
  }

  waitFor(match: (message: ServerMessage) => boolean, timeoutMs = 15_000): Promise<ServerMessage> {
    const seen = this.received.find(match);
    if (seen) return Promise.resolve(seen);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timed out waiting for a stream message")), timeoutMs);
      this.#waiters.push({ match, resolve: (message) => (clearTimeout(timer), resolve(message)) });
    });
  }

  // Waits until a chat has a message matching `match`.
  async waitForMessage(stream: string, match: (message: ChatMessage) => boolean, timeoutMs = 15_000): Promise<ChatMessage> {
    const find = () => this.messages.get(stream)?.find(match);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const found = find();
      if (found) return found;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`timed out waiting for a chat message on ${stream}`);
  }

  async waitForLive(stream: string, match: (live: LiveState) => boolean, timeoutMs = 15_000): Promise<LiveState> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const live = this.live.get(stream);
      if (live && match(live)) return live;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`timed out waiting for live state on ${stream}`);
  }

  close(): void {
    this.#socket?.close();
  }

  #receive(message: ServerMessage): void {
    this.received.push(message);
    this.#track(message);
    for (const waiter of [...this.#waiters]) {
      if (!waiter.match(message)) continue;
      this.#waiters = this.#waiters.filter((other) => other !== waiter);
      waiter.resolve(message);
    }
  }

  #track(message: ServerMessage): void {
    if (message.type === "snapshot") {
      this.positions.set(message.stream, { epoch: message.epoch, seq: message.seq });
      const snapshot = message.snapshot as ChatSnapshot;
      if ("messages" in snapshot) {
        this.messages.set(message.stream, [...snapshot.messages]);
        this.live.set(message.stream, snapshot.live);
      }
    }
    if (message.type === "event") this.#apply(message.stream, message.epoch, message.seq, message.event);
    if (message.type === "catchup") for (const item of message.events) this.#apply(message.stream, message.epoch, item.seq, item.event);
  }

  #apply(stream: string, epoch: string, seq: number, event: StreamEvent): void {
    this.positions.set(stream, { epoch, seq });
    const chatEvent = event as ChatEvent;
    if (chatEvent.type === "message") this.messages.set(stream, [...(this.messages.get(stream) ?? []), chatEvent.message]);
    if (chatEvent.type === "live_patch") this.live.set(stream, patched(this.live.get(stream), chatEvent.patch));
  }
}

// Applies a live patch with the apps' own function. A patch that fails its check fails the test.
function patched(live: LiveState | undefined, patch: LivePatch): LiveState {
  const next = live === undefined ? undefined : applyLivePatch(live, patch);
  if (next === undefined || !hashesMatch(next, expectedHashes(new Map(), patch))) throw new Error(`live patch failed its check: ${JSON.stringify(patch)}`);
  return next;
}

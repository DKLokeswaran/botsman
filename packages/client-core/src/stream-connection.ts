import type { ClientMessage, ServerMessage, StreamPosition } from "@botsman/protocol";
import { Store } from "./store.ts";

// The part of a WebSocket the connection uses, so each app can pass its own. The handlers take `any` so that a
// browser's WebSocket, React Native's, and Node's all fit without a wrapper.
export type SocketLike = {
  send(data: string): void;
  close(): void;
  onopen: ((event: any) => void) | null;
  onmessage: ((event: any) => void) | null;
  onclose: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
};

export type ConnectionStatus = "offline" | "connecting" | "online" | "reconnecting";

// What a stream's listener receives: a fresh snapshot, the events missed while away, or one live event.
export type StreamMessage = Extract<ServerMessage, { type: "snapshot" | "catchup" | "event" }>;
export type StreamListener = (message: StreamMessage) => void;

export type StreamConnectionOptions = {
  url: string;
  createSocket: (url: string) => SocketLike;
  token: () => Promise<string>;
  // Called when the server refuses the token, to renew the session before the next try.
  onUnauthorized: () => Promise<void>;
};

const FIRST_RETRY_MS = 500;
const LONGEST_RETRY_MS = 15_000;
const PING_EVERY_MS = 25_000;
const PONG_WITHIN_MS = 10_000;
// A stream asks for a fresh snapshot at most this often, so a repeatable bug can't ask on every patch or reconnect.
const RESYNC_EVERY_MS = 10_000;

// The live updates socket. It stays connected, signs in again after a drop, and asks each stream for what it
// missed, so listeners see every event once and in order.
export class StreamConnection {
  readonly status = new Store<ConnectionStatus>("offline");
  readonly #options: StreamConnectionOptions;
  readonly #listeners = new Map<string, Set<StreamListener>>();
  readonly #positions = new Map<string, StreamPosition>();
  // Streams waiting for a fresh snapshot, when each last asked for one, and the asks waiting for their turn.
  readonly #resyncing = new Set<string>();
  readonly #lastResync = new Map<string, number>();
  readonly #resyncTimers = new Map<string, ReturnType<typeof setTimeout>>();
  #socket: SocketLike | undefined;
  #ready = false;
  #running = false;
  #everOnline = false;
  #retryMs = FIRST_RETRY_MS;
  #retryTimer: ReturnType<typeof setTimeout> | undefined;
  #pingTimer: ReturnType<typeof setInterval> | undefined;
  #pongTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(options: StreamConnectionOptions) {
    this.#options = options;
  }

  start(): void {
    if (this.#running) return;
    this.#running = true;
    void this.#connect();
  }

  stop(): void {
    this.#running = false;
    this.#everOnline = false;
    clearTimeout(this.#retryTimer);
    for (const timer of this.#resyncTimers.values()) clearTimeout(timer);
    this.#resyncTimers.clear();
    this.#dropSocket();
    this.status.set("offline");
  }

  // Throws away what a stream's listeners hold and asks for a fresh snapshot, when an update didn't fit. Events
  // already on their way are dropped until the snapshot arrives.
  resync(stream: string): void {
    if (!this.#listeners.has(stream)) return;
    this.#positions.delete(stream);
    this.#resyncing.add(stream);
    if (this.#resyncTimers.has(stream)) return;
    const wait = (this.#lastResync.get(stream) ?? -Infinity) + RESYNC_EVERY_MS - Date.now();
    if (wait <= 0) return this.#askForSnapshot(stream);
    this.#resyncTimers.set(stream, setTimeout(() => this.#askForSnapshot(stream), wait));
  }

  // Subscribes without a position. While offline, the next connection does it, since the position is gone.
  #askForSnapshot(stream: string): void {
    this.#resyncTimers.delete(stream);
    this.#lastResync.set(stream, Date.now());
    if (this.#ready) this.#sendSubscribe(stream);
  }

  // An error about one stream forgets where it was, and ends a resync, so it never stays stuck dropping events.
  #forgetStream(stream: string): void {
    this.#positions.delete(stream);
    this.#endResync(stream);
  }

  #endResync(stream: string): void {
    this.#resyncing.delete(stream);
    clearTimeout(this.#resyncTimers.get(stream));
    this.#resyncTimers.delete(stream);
  }

  // Listens to one stream. The first listener subscribes on the server, and the last one to leave unsubscribes.
  subscribe(stream: string, listener: StreamListener): () => void {
    const listeners = this.#listeners.get(stream) ?? new Set<StreamListener>();
    this.#listeners.set(stream, listeners);
    listeners.add(listener);
    if (listeners.size === 1 && this.#ready) this.#sendSubscribe(stream);
    return () => this.#unsubscribe(stream, listener);
  }

  #unsubscribe(stream: string, listener: StreamListener): void {
    const listeners = this.#listeners.get(stream);
    if (listeners === undefined || !listeners.delete(listener) || listeners.size > 0) return;
    this.#listeners.delete(stream);
    this.#positions.delete(stream);
    this.#endResync(stream);
    if (this.#ready) this.#send({ type: "unsubscribe", stream });
  }

  async #connect(): Promise<void> {
    this.status.set(this.#everOnline ? "reconnecting" : "connecting");
    const token = await this.#options.token().catch(() => undefined);
    if (!this.#running) return;
    if (token === undefined) return this.#retryLater();
    const socket = this.#options.createSocket(this.#options.url);
    this.#socket = socket;
    socket.onopen = () => this.#send({ type: "hello", token });
    socket.onmessage = (event: { data: unknown }) => this.#receive(socket, String(event.data));
    socket.onclose = () => this.#lost(socket);
    socket.onerror = () => this.#lost(socket);
  }

  #receive(socket: SocketLike, text: string): void {
    if (socket !== this.#socket) return;
    const message = JSON.parse(text) as ServerMessage;
    if (message.type === "pong") return clearTimeout(this.#pongTimer);
    if (message.type === "ready") return this.#online();
    if (message.type === "error") return this.#refused(message);
    this.#deliver(message);
  }

  #online(): void {
    this.#ready = true;
    this.#everOnline = true;
    this.#retryMs = FIRST_RETRY_MS;
    this.status.set("online");
    // A stream waiting for its turn to resync subscribes when its turn comes.
    for (const stream of this.#listeners.keys()) if (!this.#resyncTimers.has(stream)) this.#sendSubscribe(stream);
    this.#pingTimer = setInterval(() => this.#ping(), PING_EVERY_MS);
  }

  // A refused token is renewed before the next try. An error about one stream forgets where that stream was.
  #refused(message: Extract<ServerMessage, { type: "error" }>): void {
    if (message.stream !== undefined) return this.#forgetStream(message.stream);
    if (message.error !== "unauthorized") return;
    const socket = this.#socket;
    this.#dropSocket();
    void this.#options.onUnauthorized().then(
      () => this.#lost(socket),
      () => this.stop(),
    );
  }

  // A stream nobody listens to anymore records nothing, so the next listener starts from a snapshot. A resyncing
  // stream drops everything until its snapshot.
  #deliver(message: StreamMessage): void {
    if (!this.#listeners.has(message.stream)) return;
    if (this.#resyncing.has(message.stream)) {
      if (message.type !== "snapshot") return;
      this.#endResync(message.stream);
    }
    this.#positions.set(message.stream, { epoch: message.epoch, seq: lastSeq(message, this.#positions.get(message.stream)) });
    for (const listener of [...(this.#listeners.get(message.stream) ?? [])]) listener(message);
  }

  #sendSubscribe(stream: string): void {
    const since = this.#positions.get(stream);
    this.#send({ type: "subscribe", stream, ...(since === undefined ? {} : { since }) });
  }

  // A socket that stops answering pings is treated as lost, so a silent drop still reconnects.
  #ping(): void {
    this.#send({ type: "ping" });
    clearTimeout(this.#pongTimer);
    this.#pongTimer = setTimeout(() => this.#lost(this.#socket), PONG_WITHIN_MS);
  }

  #lost(socket: SocketLike | undefined): void {
    if (socket !== undefined && socket !== this.#socket && this.#socket !== undefined) return;
    this.#dropSocket();
    if (this.#running) this.#retryLater();
  }

  #retryLater(): void {
    this.status.set(this.#everOnline ? "reconnecting" : "connecting");
    clearTimeout(this.#retryTimer);
    this.#retryTimer = setTimeout(() => void this.#connect(), this.#retryMs);
    this.#retryMs = Math.min(this.#retryMs * 2, LONGEST_RETRY_MS);
  }

  #dropSocket(): void {
    clearInterval(this.#pingTimer);
    clearTimeout(this.#pongTimer);
    const socket = this.#socket;
    this.#socket = undefined;
    this.#ready = false;
    if (socket === undefined) return;
    socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
    socket.close();
  }

  #send(message: ClientMessage): void {
    this.#socket?.send(JSON.stringify(message));
  }
}

// The newest sequence number a message carries. An empty catch-up leaves the position where it was.
function lastSeq(message: StreamMessage, known: StreamPosition | undefined): number {
  if (message.type !== "catchup") return message.seq;
  return message.events.at(-1)?.seq ?? known?.seq ?? 0;
}

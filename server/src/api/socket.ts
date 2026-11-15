import { botIdOfStream, ClientMessage, SERVER_STREAM, type ServerMessage, type ServerSnapshot, type StreamEvent, type StreamPosition } from "@botsman/protocol";
import { compile } from "@earendil-works/pi-schema";
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import type { Sequenced } from "../events/stream-hub.ts";
import type { Services } from "../services.ts";

const checkMessage = compile(ClientMessage);
const SESSION_CHECK_MS = 60_000;

// The live updates socket. A client signs in with its first message, then subscribes to streams. On subscribe it
// sends where it left off; the server replies with what it missed, or with a fresh snapshot when it can't.
export function registerSocket(app: FastifyInstance, services: Services): void {
  app.get("/api/ws", { websocket: true, config: { public: true } }, (socket) => {
    new SocketSession(socket as unknown as WebSocket, services).start();
  });
}

class SocketSession {
  readonly #socket: WebSocket;
  readonly #services: Services;
  readonly #subscriptions = new Map<string, () => void>();
  #sessionId: string | undefined;
  #timer: NodeJS.Timeout | undefined;

  constructor(socket: WebSocket, services: Services) {
    this.#socket = socket;
    this.#services = services;
  }

  start(): void {
    this.#socket.on("message", (data) => void this.#receive(String(data)).catch((error) => this.#fail("internal", String(error))));
    this.#socket.on("close", () => this.#closeAll());
  }

  async #receive(text: string): Promise<void> {
    const message = parse(text);
    if (message === undefined) return this.#send({ type: "error", error: "bad_request", message: "Unknown message" });
    if (message.type === "ping") return this.#send({ type: "pong" });
    if (message.type === "hello") return this.#hello(message.token);
    if (this.#sessionId === undefined) return this.#fail("unauthorized", "Send hello with an access token first");
    if (message.type === "subscribe") return this.#subscribe(message.stream, message.since);
    this.#subscriptions.get(message.stream)?.();
    this.#subscriptions.delete(message.stream);
  }

  #hello(token: string): void {
    try {
      this.#sessionId = this.#services.auth.verifyAccess(token);
    } catch {
      return this.#fail("unauthorized", "Access token is not valid");
    }
    // A revoked device loses its socket within a minute.
    this.#timer = setInterval(() => {
      if (!this.#services.auth.sessionLive(this.#sessionId!)) this.#fail("unauthorized", "Signed out");
    }, SESSION_CHECK_MS);
    this.#send({ type: "ready", epoch: this.#services.hub.epoch });
  }

  async #subscribe(stream: string, since: StreamPosition | undefined): Promise<void> {
    if (!this.#allowed(stream)) return this.#send({ type: "error", error: "not_found", message: "No such stream", stream });
    this.#subscriptions.get(stream)?.();
    const { hub } = this.#services;
    const missed = since === undefined ? undefined : hub.since(stream, since.epoch, since.seq);
    if (missed !== undefined) {
      this.#send({ type: "catchup", stream, epoch: hub.epoch, events: missed });
      this.#subscriptions.set(stream, hub.subscribe(stream, (item) => this.#event(stream, item)));
      return;
    }
    // Events published while the snapshot is built are held, then sent if they are newer than the snapshot.
    const held: Sequenced<StreamEvent>[] = [];
    let live = false;
    const unsubscribe = hub.subscribe(stream, (item) => (live ? this.#event(stream, item) : held.push(item)));
    this.#subscriptions.set(stream, unsubscribe);
    const snapshot = await this.#snapshot(stream);
    const seq = hub.currentSeq(stream);
    this.#send({ type: "snapshot", stream, epoch: hub.epoch, seq, snapshot });
    for (const item of held) if (item.seq > seq) this.#event(stream, item);
    live = true;
  }

  async #snapshot(stream: string) {
    const services = this.#services;
    const botId = botIdOfStream(stream);
    if (botId === undefined) return this.#serverSnapshot();
    const bot = services.bots.get(botId);
    if (services.sandbox.status.ok) await services.engine.view(bot);
    return services.feed.snapshot(bot.id, services.registry.chatSettings(bot));
  }

  #serverSnapshot(): ServerSnapshot {
    const services = this.#services;
    const bots = services.bots.list();
    const botIds = bots.map((bot) => bot.id);
    return {
      bots,
      approvals: services.approvalStore.list({ status: "pending", botIds }),
    };
  }

  #allowed(stream: string): boolean {
    if (stream === SERVER_STREAM) return true;
    const botId = botIdOfStream(stream);
    return botId !== undefined && this.#services.registry.get(botId) !== undefined;
  }

  #event(stream: string, item: Sequenced<StreamEvent>): void {
    this.#send({ type: "event", stream, epoch: this.#services.hub.epoch, seq: item.seq, event: item.event });
  }

  #send(message: ServerMessage): void {
    if (this.#socket.readyState === this.#socket.OPEN) this.#socket.send(JSON.stringify(message));
  }

  #fail(error: string, message: string): void {
    this.#send({ type: "error", error, message });
    this.#socket.close(4001, error);
  }

  #closeAll(): void {
    clearInterval(this.#timer);
    for (const unsubscribe of this.#subscriptions.values()) unsubscribe();
    this.#subscriptions.clear();
  }
}

function parse(text: string): ClientMessage | undefined {
  try {
    const value: unknown = JSON.parse(text);
    return checkMessage.check(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

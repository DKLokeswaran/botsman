import type { ClientMessage, ServerMessage } from "@botsman/protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type SocketLike, StreamConnection, type StreamMessage } from "../src/index.ts";

const STREAM = "chat:b1";

// A socket driven by hand, recording what the connection sends.
class FakeSocket implements SocketLike {
  sent: ClientMessage[] = [];
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: unknown) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  send(data: string) {
    this.sent.push(JSON.parse(data) as ClientMessage);
  }
  close() {}
  receive(message: ServerMessage) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  subscribes() {
    return this.sent.filter((message) => message.type === "subscribe");
  }
}

const event = (seq: number): ServerMessage => ({ type: "event", stream: STREAM, epoch: "e", seq, event: { type: "live_patch", patch: { running: true } } });
const snapshot = (seq: number): ServerMessage => ({ type: "snapshot", stream: STREAM, epoch: "e", seq, snapshot: { bots: [], approvals: [] } });

// A started connection with one listener on the chat stream.
async function connected() {
  const sockets: FakeSocket[] = [];
  const connection = new StreamConnection({
    url: "ws://test",
    createSocket: () => (sockets.push(new FakeSocket()), sockets.at(-1)!),
    token: async () => "token",
    onUnauthorized: async () => {},
  });
  const heard: StreamMessage[] = [];
  connection.start();
  await vi.advanceTimersByTimeAsync(0);
  const online = async () => {
    const socket = sockets.at(-1)!;
    socket.onopen?.({});
    socket.receive({ type: "ready", epoch: "e" });
    return socket;
  };
  let socket = await online();
  const unsubscribe = connection.subscribe(STREAM, (message) => heard.push(message));
  socket.receive(snapshot(1));
  // Drops the socket and connects again.
  const reconnect = async () => {
    sockets.at(-1)!.onclose?.({});
    await vi.advanceTimersByTimeAsync(1_000);
    socket = await online();
    return socket;
  };
  return { connection, heard, unsubscribe, socket: () => socket, reconnect };
}

beforeEach(() => void vi.useFakeTimers());
afterEach(() => void vi.useRealTimers());

describe("resync", () => {
  it("drops a resyncing stream's events, and records no position until its snapshot arrives", async () => {
    const { connection, heard, socket, reconnect } = await connected();
    connection.resync(STREAM);
    expect(socket().subscribes().at(-1)).toEqual({ type: "subscribe", stream: STREAM });
    socket().receive(event(2));
    expect(heard).toHaveLength(1);
    expect((await reconnect()).subscribes().at(-1)).toEqual({ type: "subscribe", stream: STREAM });
    socket().receive(snapshot(5));
    socket().receive(event(6));
    expect(heard.map((message) => message.type)).toEqual(["snapshot", "snapshot", "event"]);
  });

  it("ends on a stream error or when the last listener leaves", async () => {
    const { connection, heard, socket, unsubscribe } = await connected();
    connection.resync(STREAM);
    socket().receive({ type: "error", error: "not_found", message: "gone", stream: STREAM });
    socket().receive(event(2));
    expect(heard).toHaveLength(2);
    connection.resync(STREAM);
    unsubscribe();
    const again: StreamMessage[] = [];
    connection.subscribe(STREAM, (message) => again.push(message));
    socket().receive(event(3));
    expect(again).toHaveLength(1);
  });

  it("asks at most once every 10 seconds, and sends a waiting ask when its turn comes", async () => {
    const { connection, heard, socket, reconnect } = await connected();
    connection.resync(STREAM);
    socket().receive(snapshot(2));
    connection.resync(STREAM);
    socket().receive(event(3));
    expect(heard).toHaveLength(2);
    expect((await reconnect()).subscribes()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(socket().subscribes()).toEqual([{ type: "subscribe", stream: STREAM }]);
  });

  it("subscribes on the next connection when its turn came while offline", async () => {
    const { connection, socket, reconnect } = await connected();
    connection.resync(STREAM);
    socket().receive(snapshot(2));
    connection.resync(STREAM);
    socket().onclose?.({});
    await vi.advanceTimersByTimeAsync(10_000);
    expect((await reconnect()).subscribes()).toEqual([{ type: "subscribe", stream: STREAM }]);
  });

  it("cancels a waiting ask when the resync ends", async () => {
    const { connection, socket } = await connected();
    connection.resync(STREAM);
    socket().receive(snapshot(2));
    connection.resync(STREAM);
    socket().receive({ type: "error", error: "not_found", message: "gone", stream: STREAM });
    const before = socket().subscribes().length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(socket().subscribes()).toHaveLength(before);
  });
});

it("records no position for a stream nobody listens to", async () => {
  const { connection, socket, unsubscribe } = await connected();
  unsubscribe();
  socket().receive(event(2));
  connection.subscribe(STREAM, () => {});
  expect(socket().subscribes().at(-1)).toEqual({ type: "subscribe", stream: STREAM });
});

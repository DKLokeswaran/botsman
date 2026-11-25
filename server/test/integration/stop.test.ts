import { connect, type AddressInfo, type Socket } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startTestServer, type TestServer } from "../helpers.ts";

const STOP_WITHIN_MS = 5_000;
const UPGRADE = "Connection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n";
const socketRequest = (path: string) => `GET ${path} HTTP/1.1\r\nHost: botsman\r\nX-Forwarded-Proto: https\r\n${UPGRADE}`;
const HALF_REQUEST = "POST /api/auth/login HTTP/1.1\r\nHost: botsman\r\nX-Forwarded-Proto: https\r\nContent-Type: application/json\r\nContent-Length: 50\r\n\r\n{";

describe("stopping the server", () => {
  let server: TestServer;
  let connection: Socket;

  beforeEach(async () => {
    server = await startTestServer();
    connection = await open((server.botsman.http.server.address() as AddressInfo).port);
  });

  afterEach(() => {
    connection.destroy();
    server.root.cleanup();
  });

  // Stops the server, and checks that it was quick and reached the storage.
  async function expectQuickStop(): Promise<void> {
    const started = Date.now();
    await server.botsman.stop();
    expect(Date.now() - started).toBeLessThan(STOP_WITHIN_MS);
    expect(() => server.botsman.services.db.prepare("SELECT 1")).toThrow();
  }

  it.each(["/api/ws", "/api/alerts"])("doesn't wait for a client of %s that never answers the close", async (path) => {
    const answer = new Promise<string>((resolve) => connection.once("data", (data) => resolve(String(data))));
    connection.write(socketRequest(path));
    expect(await answer).toContain("101 Switching Protocols");
    connection.resume();
    await expectQuickStop();
  });

  it("doesn't wait for a connection that sent nothing", expectQuickStop);

  it("doesn't wait for a request that never finishes", async () => {
    const arrived = new Promise((resolve) => server.botsman.http.server.once("request", resolve));
    connection.write(HALF_REQUEST);
    await arrived;
    await expectQuickStop();
  });
});

// A raw connection, which does nothing a real client would do by itself.
function open(port: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, "127.0.0.1", () => resolve(socket));
    socket.on("error", reject);
  });
}

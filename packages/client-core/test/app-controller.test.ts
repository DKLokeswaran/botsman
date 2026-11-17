import { startTestServer, type TestServer } from "@botsman/server/test/helpers.ts";
import { afterAll, beforeAll, expect, it } from "vitest";
import { AppController, type AppEnvironment, type SocketLike } from "../src/index.ts";
import { PASSWORD, memoryTokenStore, proxiedFetch, until } from "./real-server.ts";

let server: TestServer;
const saved = { address: undefined as string | undefined };
const tokenStore = memoryTokenStore();

const environment = (): AppEnvironment => ({
  fetch: proxiedFetch,
  createSocket: (url) => new WebSocket(url, { headers: { "x-forwarded-proto": "https" } } as unknown as string[]) as unknown as SocketLike,
  deviceName: "controller test",
  tokenStore,
  savedServer: {
    load: async () => saved.address,
    save: async (address) => void (saved.address = address),
    clear: async () => void (saved.address = undefined),
  },
});

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.botsman.stop();
  server.root.cleanup();
});

it("asks for a server on first launch, and explains an address that doesn't answer", async () => {
  const app = new AppController(environment());
  await app.start();
  expect(app.state.get()).toEqual({ step: "choose_server", address: "", error: undefined });

  await app.connect("http://127.0.0.1:1");
  expect(app.state.get()).toMatchObject({ step: "choose_server", address: "http://127.0.0.1:1", error: "Can't reach the server" });
});

it("runs first-run setup on a new server, asks for a model provider, gives the main bot a model, then shows the main screens", async () => {
  const app = new AppController(environment());
  await app.connect(server.baseUrl);
  const state = app.state.get();
  if (state.step !== "set_up") throw new Error(`expected set_up, got ${state.step}`);
  expect(saved.address).toBe(server.baseUrl);

  await state.client.session.setUp(PASSWORD, { name: "Main" });
  expect(app.state.get().step).toBe("add_provider");
  await state.client.saveApiKey("script", "test-key");
  await until(state.client.server, (server) => server.status === "ready");
  await app.finishSetup();
  expect(app.state.get().step).toBe("ready");
  const main = (await state.client.session.request<{ bots: { isMain: boolean; defaultModel: unknown }[] }>("GET", "/api/bots")).bots.find((bot) => bot.isMain);
  expect(main?.defaultModel).toEqual({ provider: "script", modelId: "script-1" });
  state.client.connection.stop();
});

it("returns to the main screens on the next launch, without asking again", async () => {
  const app = new AppController(environment());
  await app.start();
  const state = app.state.get();
  if (state.step !== "ready") throw new Error(`expected ready, got ${state.step}`);
  await until(state.client.server, (server) => server.status === "ready");
  state.client.connection.stop();
});

it("asks for the password after signing out, and for a server after changing it", async () => {
  const app = new AppController(environment());
  await app.start();
  const state = app.state.get();
  if (state.step !== "ready") throw new Error(`expected ready, got ${state.step}`);

  await state.client.session.signOut();
  expect(app.state.get().step).toBe("sign_in");
  await state.client.session.signIn(PASSWORD);
  expect(app.state.get().step).toBe("ready");

  await app.changeServer();
  expect(app.state.get()).toEqual({ step: "choose_server", address: "", error: undefined });
  expect(saved.address).toBeUndefined();
  expect(tokenStore.tokens).toBeUndefined();
});

it("stops with the side to update when the protocols don't fit", async () => {
  const withProtocol = (protocol: { oldest: number; current: number }): AppEnvironment => ({
    ...environment(),
    fetch: async (url, init) => {
      const response = await proxiedFetch(url, init);
      if (!url.endsWith("/api/health")) return response;
      const health = JSON.parse(await response.text()) as Record<string, unknown>;
      return { ok: true, status: 200, text: async () => JSON.stringify({ ...health, protocol }) };
    },
  });
  const tooOld = new AppController(withProtocol({ oldest: 2, current: 3 }));
  await tooOld.connect(server.baseUrl);
  expect(tooOld.state.get().step).toBe("update_app");

  const tooNew = new AppController(withProtocol({ oldest: 0, current: 0 }));
  await tooNew.connect(server.baseUrl);
  expect(tooNew.state.get().step).toBe("update_server");
});

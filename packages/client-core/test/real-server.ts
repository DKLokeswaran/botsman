import { PASSWORD, SCRIPT_MODEL_REF, startTestServer, type TestServer } from "@botsman/server/test/helpers.ts";
import { SCRIPT_PROVIDER } from "@botsman/server/src/testing/script-model.ts";
import type { Tokens } from "@botsman/protocol";
import { BotsmanClient, type Fetch, type SocketLike, type Store, type TokenStore } from "../src/index.ts";

export { PASSWORD };

// The test server has no proxy in front of it, so the client says what Tailscale Serve or Caddy would.
const PROXY_HEADERS = { "x-forwarded-proto": "https" };

export const proxiedFetch: Fetch = (url, init) => fetch(url, { ...init, headers: { ...init?.headers, ...PROXY_HEADERS } });

export function memoryTokenStore(): TokenStore & { tokens: Tokens | undefined } {
  const store = {
    tokens: undefined as Tokens | undefined,
    load: async () => store.tokens,
    save: async (tokens: Tokens) => void (store.tokens = tokens),
    clear: async () => void (store.tokens = undefined),
  };
  return store;
}

export type Rig = { server: TestServer; client: BotsmanClient; sockets: SocketLike[]; tokenStore: ReturnType<typeof memoryTokenStore>; stop: () => Promise<void> };

// A real server with the scripted model, and a client signed in to it as an app would be.
export async function startRig(): Promise<Rig> {
  const server = await startTestServer();
  const sockets: SocketLike[] = [];
  const tokenStore = memoryTokenStore();
  const client = new BotsmanClient({
    baseUrl: server.baseUrl,
    fetch: proxiedFetch,
    deviceName: "client-core test",
    tokenStore,
    createSocket: (url) => {
      const socket = new WebSocket(url, { headers: PROXY_HEADERS } as unknown as string[]) as unknown as SocketLike;
      // Only the live updates socket is kept, so tests can drop it; the alerts socket comes and goes on its own.
      if (url.endsWith("/api/ws")) sockets.push(socket);
      return socket;
    },
  });
  await client.session.setUp(PASSWORD, { name: "Main", purpose: "Help the owner.", defaultModel: SCRIPT_MODEL_REF });
  await client.session.request("PUT", `/api/providers/${SCRIPT_PROVIDER}/key`, { key: "test-key" });
  const stop = async () => {
    client.connection.stop();
    await server.botsman.stop();
    server.root.cleanup();
  };
  return { server, client, sockets, tokenStore, stop };
}

// Waits until a store's value passes a check.
export async function until<T>(store: Store<T>, passes: (value: T) => boolean, timeoutMs = 15_000): Promise<T> {
  if (passes(store.get())) return store.get();
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => (unsubscribe(), reject(new Error(`timed out; last value: ${JSON.stringify(store.get()).slice(0, 400)}`))), timeoutMs);
    const unsubscribe = store.subscribe(() => {
      if (!passes(store.get())) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(store.get());
    });
  });
}

import type { BotCreate, SessionInfo, SetupStatus, Tokens } from "@botsman/protocol";
import { ApiClient, ApiError, type Fetch } from "./api-client.ts";
import { Store } from "./store.ts";

// Where an app keeps its tokens between launches: Credential Manager on Windows, the Keystore on Android.
// The web dashboard has none, because its tokens live in cookies the page can't read.
export type TokenStore = {
  load(): Promise<Tokens | undefined>;
  save(tokens: Tokens): Promise<void>;
  clear(): Promise<void>;
};

export type SessionState = { status: "loading" } | { status: "signed_out" } | { status: "signed_in"; sessionId: string };

export type SessionOptions = {
  baseUrl: string;
  fetch: Fetch;
  deviceName: string;
  tokenStore?: TokenStore;
  now?: () => number;
};

// Renew the access token this long before it runs out, so a request never leaves with a token about to expire.
const RENEW_MARGIN_MS = 30_000;

type Held = SessionInfo & { accessToken?: string; refreshToken?: string };

// Signs the owner in, keeps the session alive by renewing its tokens, and sends authenticated requests.
export class Session {
  readonly state = new Store<SessionState>({ status: "loading" });
  readonly #api: ApiClient;
  readonly #options: SessionOptions;
  readonly #now: () => number;
  #held: Held | undefined;
  #renewing: Promise<void> | undefined;

  constructor(options: SessionOptions) {
    this.#options = options;
    this.#now = options.now ?? Date.now;
    this.#api = new ApiClient({ baseUrl: options.baseUrl, fetch: options.fetch, accessToken: () => this.#held?.accessToken });
  }

  get usesCookies(): boolean {
    return this.#options.tokenStore === undefined;
  }

  // Picks up where the last launch left off. An app reads its stored tokens; the dashboard asks the server.
  async restore(): Promise<void> {
    const stored = await this.#options.tokenStore?.load();
    if (stored !== undefined && stored.refreshExpiresAt > this.#now()) {
      this.#hold(stored);
      return;
    }
    if (!this.usesCookies) return this.#signedOut();
    await this.#renew().catch(() => this.#signedOut());
  }

  setupStatus(): Promise<SetupStatus> {
    return this.#api.request("GET", "/api/setup");
  }

  async setUp(password: string, mainBot: BotCreate): Promise<void> {
    await this.#start("/api/setup", { password, mainBot });
  }

  async signIn(password: string): Promise<void> {
    await this.#start("/api/auth/login", { password });
  }

  async signOut(): Promise<void> {
    await this.request("POST", "/api/auth/logout").catch(() => undefined);
    await this.#forget();
  }

  // Sends a request as the signed-in owner, renewing the access token first when it is about to run out.
  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    await this.#renewIfDue();
    try {
      return await this.#api.request<T>(method, path, body);
    } catch (error) {
      if (!isUnauthorized(error)) throw error;
      await this.#renew();
      return this.#api.request<T>(method, path, body);
    }
  }

  // The token a socket signs in with. The dashboard sends an empty one and the server reads its cookie.
  async socketToken(): Promise<string> {
    await this.#renewIfDue();
    return this.#held?.accessToken ?? "";
  }

  // Forces a renewal, for a socket the server closed as signed out.
  renew(): Promise<void> {
    return this.#renew();
  }

  async #start(path: string, body: Record<string, unknown>): Promise<void> {
    const reply = await this.#api.request<Tokens | SessionInfo>("POST", path, { ...body, deviceName: this.#options.deviceName, ...(this.usesCookies ? { cookie: true } : {}) });
    await this.#keep(reply);
  }

  async #renewIfDue(): Promise<void> {
    if (this.#held !== undefined && this.#held.accessExpiresAt - this.#now() < RENEW_MARGIN_MS) await this.#renew();
  }

  // One renewal at a time: a refresh token works once, so parallel requests share the same renewal.
  #renew(): Promise<void> {
    this.#renewing ??= this.#renewOnce().finally(() => (this.#renewing = undefined));
    return this.#renewing;
  }

  async #renewOnce(): Promise<void> {
    const refreshToken = this.#held?.refreshToken;
    try {
      const reply = await this.#api.request<Tokens | SessionInfo>("POST", "/api/auth/refresh", refreshToken === undefined ? {} : { refreshToken });
      await this.#keep(reply);
    } catch (error) {
      if (isUnauthorized(error) || isForbidden(error)) await this.#forget();
      throw error;
    }
  }

  async #keep(reply: Tokens | SessionInfo): Promise<void> {
    if ("refreshToken" in reply) await this.#options.tokenStore?.save(reply);
    this.#hold(reply);
  }

  // Renewing tokens keeps the same session, so it leaves the state alone and screens following it don't start over.
  #hold(held: Held): void {
    this.#held = held;
    const current = this.state.get();
    if (current.status === "signed_in" && current.sessionId === held.sessionId) return;
    this.state.set({ status: "signed_in", sessionId: held.sessionId });
  }

  async #forget(): Promise<void> {
    await this.#options.tokenStore?.clear();
    this.#signedOut();
  }

  #signedOut(): void {
    this.#held = undefined;
    this.state.set({ status: "signed_out" });
  }
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

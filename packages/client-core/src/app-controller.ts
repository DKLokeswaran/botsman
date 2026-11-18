import { type Health, PROTOCOL_VERSION, protocolFit } from "@botsman/protocol";
import type { Fetch } from "./api-client.ts";
import { BotsmanClient } from "./botsman-client.ts";
import type { TokenStore } from "./session.ts";
import { Store } from "./store.ts";
import type { SocketLike } from "./stream-connection.ts";
import { suggestedModel } from "./bot-settings.ts";
import { BackgroundAlerts, type BackgroundAlertsService } from "./background-alerts.ts";
import type { LocalCache } from "./local-cache.ts";
import { type AppUpdater, UpdateChecker } from "./updates.ts";

// What each app supplies from its platform. The web dashboard has a fixed server, the one that served it,
// and no token store, because its session lives in cookies.
export type AppEnvironment = {
  // The name the app shows, from its own config, so a preview build says Botsman Preview.
  appName: string;
  fetch: Fetch;
  createSocket: (url: string) => SocketLike;
  deviceName: string;
  fixedServer?: string;
  tokenStore?: TokenStore;
  savedServer?: { load(): Promise<string | undefined>; save(address: string): Promise<void>; clear(): Promise<void> };
  updater?: AppUpdater;
  backgroundAlerts?: BackgroundAlertsService;
  cache?: LocalCache;
};

// Where the app is on its way to a working connection. Each step is one screen.
export type AppState =
  | { step: "starting" }
  | { step: "choose_server"; address: string; error: string | undefined }
  | { step: "update_app"; client: BotsmanClient }
  | { step: "update_server"; client: BotsmanClient }
  | { step: "set_up"; client: BotsmanClient }
  | { step: "sign_in"; client: BotsmanClient }
  // First run only, right after setup: connect a model provider before the main screens.
  | { step: "add_provider"; client: BotsmanClient }
  | { step: "ready"; client: BotsmanClient };

// Takes the app from launch to a signed-in connection: the server address, the protocol check, first-run setup
// or sign-in, and back to sign-in whenever the session ends.
export class AppController {
  readonly state = new Store<AppState>({ step: "starting" });
  // What the connected server said about itself when the app connected, for its version and update notice.
  readonly serverHealth = new Store<Health | undefined>(undefined);
  // Present on the apps that update themselves. The web dashboard has none.
  readonly updates: UpdateChecker | undefined;
  // Present on the apps that keep alerts coming while closed.
  readonly background: BackgroundAlerts | undefined;
  readonly appName: string;
  readonly #environment: AppEnvironment;
  #unfollow: (() => void) | undefined;

  constructor(environment: AppEnvironment) {
    this.#environment = environment;
    this.appName = environment.appName;
    this.updates = environment.updater === undefined ? undefined : new UpdateChecker(environment.updater);
    this.background = environment.backgroundAlerts === undefined ? undefined : new BackgroundAlerts(environment.backgroundAlerts);
  }

  get canChangeServer(): boolean {
    return this.#environment.fixedServer === undefined;
  }

  // Connects to the fixed server or the one saved from last time, or asks for an address.
  async start(): Promise<void> {
    const address = this.#environment.fixedServer ?? (await this.#environment.savedServer?.load());
    if (address === undefined) return this.#choose("", undefined);
    await this.connect(address);
  }

  // Checks that a Botsman server answers at the address and that both sides speak a protocol in common.
  async connect(address: string): Promise<void> {
    this.#release();
    this.state.set({ step: "starting" });
    const client = this.#clientFor(address);
    try {
      const health = await client.health();
      this.serverHealth.set(health);
      await this.#environment.savedServer?.save(client.baseUrl);
      void this.updates?.check(health.protocol);
      const fit = protocolFit(PROTOCOL_VERSION, health.protocol);
      if (fit !== "fits") return this.state.set({ step: fit, client });
      await this.#enter(client);
    } catch (error) {
      this.#choose(address, error instanceof Error ? error.message : "Can't reach the server");
    }
  }

  // Signs out and asks for another server address.
  async changeServer(): Promise<void> {
    const current = this.state.get();
    if ("client" in current) await current.client.session.signOut().catch(() => undefined);
    this.#release();
    await this.#environment.savedServer?.clear();
    this.#choose("", undefined);
  }

  async #enter(client: BotsmanClient): Promise<void> {
    if ((await client.session.setupStatus()).needsSetup) return this.#follow(client, "set_up");
    await client.session.restore();
    this.#follow(client, "sign_in");
  }

  // Shows the main screens while signed in, and `signedOutStep` otherwise.
  #follow(client: BotsmanClient, signedOutStep: "set_up" | "sign_in"): void {
    const show = () => {
      const status = client.session.state.get().status;
      if (status === "signed_in") {
        void this.background?.connect(client).catch(() => undefined);
        // Signing in straight from first-run setup leads to adding a model provider.
        const firstRun = this.state.get().step === "set_up";
        return this.state.set({ step: firstRun ? "add_provider" : "ready", client });
      }
      const current = this.state.get();
      if (current.step === "ready") void this.background?.disconnect().catch(() => undefined);
      const next = current.step === "ready" ? "sign_in" : signedOutStep;
      if (current.step !== next) this.state.set({ step: next, client });
    };
    this.#unfollow = client.session.state.subscribe(show);
    show();
  }

  // Ends first-run setup. When a provider is now connected and the main bot has no model yet, the main bot gets the
  // first connected model as its default.
  async finishSetup(): Promise<void> {
    const current = this.state.get();
    if (current.step !== "add_provider") return;
    const { client } = current;
    const main = client.server.get().bots.find((bot) => bot.isMain);
    const models = await client.models().catch(() => []);
    if (main !== undefined && main.defaultModel === null && models.length > 0) {
      await client.updateBot(main.id, { defaultModel: suggestedModel(models, null) }).catch(() => undefined);
    }
    this.state.set({ step: "ready", client });
  }

  #clientFor(address: string): BotsmanClient {
    const { fetch, createSocket, deviceName, tokenStore, cache } = this.#environment;
    return new BotsmanClient({ baseUrl: address, fetch, createSocket, deviceName, ...(tokenStore === undefined ? {} : { tokenStore }), ...(cache === undefined ? {} : { cache }) });
  }

  #choose(address: string, error: string | undefined): void {
    this.state.set({ step: "choose_server", address, error });
  }

  #release(): void {
    this.#unfollow?.();
    this.#unfollow = undefined;
    const current = this.state.get();
    if ("client" in current) current.client.connection.stop();
  }
}

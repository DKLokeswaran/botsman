import type { AlertsToken } from "@botsman/protocol";
import { ALERT_TEMPLATES } from "./alerts-connection.ts";
import type { BotsmanClient } from "./botsman-client.ts";
import { Store } from "./store.ts";

// How the background connection is doing, for its settings: whether it runs and is connected, and the phone
// settings that can stop it. `null` means the platform has no such setting.
export type BackgroundStatus = {
  running: boolean;
  connected: boolean;
  notificationsAllowed: boolean | null;
  batteryUnrestricted: boolean | null;
  maker: string | null;
};

// A connection that keeps alerts coming while the app is closed: the Android foreground service, later the Windows
// tray. It remembers whether the owner wants it, so it can start again after a reboot.
export type BackgroundAlertsService = {
  isEnabled(): Promise<boolean>;
  start(server: string, token: string, templates: Record<string, string>): Promise<void>;
  stop(): Promise<void>;
  setEnabled(enabled: boolean): Promise<void>;
  setBotNames(names: Record<string, string>): Promise<void>;
  status(): Promise<BackgroundStatus>;
};

// Runs the background connection while the owner is signed in and wants it, with an alerts-only token, and keeps
// the bot names its notifications use up to date.
export class BackgroundAlerts {
  readonly enabled = new Store<boolean | undefined>(undefined);
  readonly #service: BackgroundAlertsService;
  #client: BotsmanClient | undefined;
  #unfollowBots: (() => void) | undefined;

  constructor(service: BackgroundAlertsService) {
    this.#service = service;
    void service.isEnabled().then((enabled) => this.enabled.set(enabled));
  }

  status(): Promise<BackgroundStatus> {
    return this.#service.status();
  }

  // Called when the owner signs in. It starts the connection if the owner wants it.
  async connect(client: BotsmanClient): Promise<void> {
    this.#client = client;
    if (await this.#service.isEnabled()) await this.#start(client);
  }

  // Called when the owner signs out, whose session the connection's token belonged to.
  async disconnect(): Promise<void> {
    this.#client = undefined;
    this.#unfollowBots?.();
    this.#unfollowBots = undefined;
    await this.#service.stop();
  }

  async setKeepConnected(on: boolean): Promise<void> {
    await this.#service.setEnabled(on);
    this.enabled.set(on);
    if (!on) return this.#service.stop();
    if (this.#client !== undefined) await this.#start(this.#client);
  }

  async #start(client: BotsmanClient): Promise<void> {
    const { token } = await client.session.request<AlertsToken>("POST", "/api/auth/alerts-token");
    await this.#service.start(client.baseUrl, token, ALERT_TEMPLATES);
    this.#unfollowBots?.();
    let last = "";
    const sendNames = () => {
      const names = Object.fromEntries(client.server.get().bots.map((bot) => [bot.id, bot.name]));
      const json = JSON.stringify(names);
      if (json === last) return;
      last = json;
      void this.#service.setBotNames(names);
    };
    this.#unfollowBots = client.server.subscribe(sendNames);
    sendNames();
  }
}

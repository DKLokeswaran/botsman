import type { ChatState } from "./chat-state.ts";
import type { ServerState } from "./server-state.ts";

// A small key-value store on the device: IndexedDB on Windows and the web, SQLite on Android. It holds the last
// state the server sent, so screens can show something at launch before the live snapshot arrives.
export type LocalCache = {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  clear(): Promise<void>;
};

const SAVE_DELAY_MS = 1_000;
const CACHED_MESSAGES = 50;

type CachedServer = Pick<ServerState, "bots" | "approvals" | "activity" | "alertSettings">;
type CachedChat = Pick<ChatState, "messages" | "hasEarlier" | "settings" | "totals">;

// Writes a value shortly after its last change, so a burst of stream events costs one write.
export class CacheWriter {
  readonly #cache: LocalCache;
  readonly #timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(cache: LocalCache) {
    this.#cache = cache;
  }

  saveLater(key: string, value: () => string): void {
    clearTimeout(this.#timers.get(key));
    this.#timers.set(key, setTimeout(() => void this.#cache.set(key, value()).catch(() => undefined), SAVE_DELAY_MS));
  }

  cancelAll(): void {
    for (const timer of this.#timers.values()) clearTimeout(timer);
    this.#timers.clear();
  }
}

export function serverToCache(state: ServerState): string {
  const cached: CachedServer = { bots: state.bots, approvals: state.approvals, activity: state.activity, alertSettings: state.alertSettings };
  return JSON.stringify(cached);
}

// Shows the cached server state while the live one is still loading.
export function serverFromCache(state: ServerState, text: string | undefined): ServerState {
  if (text === undefined || state.status !== "loading") return state;
  return { ...state, ...(JSON.parse(text) as CachedServer), status: "cached" };
}

// The newest messages of a chat, without its live state, which only the server knows.
export function chatToCache(state: ChatState): string {
  const messages = state.messages.slice(-CACHED_MESSAGES);
  const cached: CachedChat = { messages, hasEarlier: state.hasEarlier || state.messages.length > messages.length, settings: state.settings, totals: state.totals };
  return JSON.stringify(cached);
}

export function chatFromCache(state: ChatState, text: string | undefined): ChatState {
  if (text === undefined || state.status !== "loading") return state;
  return { ...state, ...(JSON.parse(text) as CachedChat), status: "cached" };
}

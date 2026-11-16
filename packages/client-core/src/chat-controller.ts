import { type ChatEvent, type ChatHistoryPage, type ChatSettings, type ChatSettingsUpdate, type ChatSnapshot, chatStream, type LiveState, type Ok, type SendMessageResponse } from "@botsman/protocol";
import { addPending, applyChatEvent, applyChatSnapshot, applyHistoryPage, type ChatState, dropPending, emptyChat, failPending } from "./chat-state.ts";
import { defaultSendMode, type SendMode } from "./send-rule.ts";
import type { Session } from "./session.ts";
import { Store } from "./store.ts";
import type { StreamConnection, StreamMessage } from "./stream-connection.ts";

const HISTORY_PAGE = 50;
// How long live updates gather before the chat redraws: 50 ms, and 1 ms more for every 100 characters streamed so
// far, up to a second. Each redraw lays out the whole reply again, so a long reply redraws less often, and updates
// that pile up while a slow device is still drawing become one redraw instead of a queue of them.
export const LIVE_REDRAW_MS = 50;
const MAX_REDRAW_MS = 1_000;

export function liveRedrawDelay(live: LiveState): number {
  const streamed = live.streamingText.length + live.streamingThinking.length;
  return Math.min(MAX_REDRAW_MS, LIVE_REDRAW_MS + Math.floor(streamed / 100));
}

// One bot's chat: its state kept current from the stream, and the owner's actions on it.
export class ChatController {
  readonly botId: string;
  readonly state = new Store<ChatState>(emptyChat);
  readonly #session: Session;
  readonly #connection: StreamConnection;
  readonly #newRequestId: () => string;
  #unsubscribe: (() => void) | undefined;
  #watchers = 0;
  #loadingEarlier = false;
  #readUpTo = 0;
  #waitingLive: LiveState | undefined;
  #liveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(botId: string, session: Session, connection: StreamConnection, newRequestId: () => string) {
    this.botId = botId;
    this.#session = session;
    this.#connection = connection;
    this.#newRequestId = newRequestId;
  }

  // Follows the chat while at least one screen shows it.
  watch(): () => void {
    this.#watchers += 1;
    this.#unsubscribe ??= this.#connection.subscribe(chatStream(this.botId), (message) => this.#receive(message));
    this.#markRead();
    return () => this.#unwatch();
  }

  // Sends a message. Without a mode it uses the one that fits the bot's state. The text shows at once as pending.
  async send(text: string, mode: SendMode = defaultSendMode(this.state.get().live)): Promise<void> {
    const requestId = this.#newRequestId();
    this.state.update((state) => addPending(state, { requestId, text, mode, failed: undefined }));
    await this.#post(requestId, text, mode);
  }

  // Sends a failed message again under the same request id, so the server can't run it twice.
  async retry(requestId: string): Promise<void> {
    const send = this.state.get().pending.find((other) => other.requestId === requestId);
    if (send === undefined) return;
    this.state.update((state) => addPending(state, { ...send, failed: undefined }));
    await this.#post(send.requestId, send.text, send.mode);
  }

  discard(requestId: string): void {
    this.state.update((state) => dropPending(state, requestId));
  }

  async stop(): Promise<void> {
    await this.#session.request<Ok>("POST", `/api/bots/${this.botId}/chat/stop`);
  }

  // Gives the bot a turn to save, then compacts the chat. The live state shows it compacting.
  async compact(): Promise<void> {
    await this.#session.request<Ok>("POST", `/api/bots/${this.botId}/chat/compact`);
  }

  // Starts a new context. Earlier messages stay visible above the notice.
  async clear(): Promise<void> {
    await this.#session.request<Ok>("POST", `/api/bots/${this.botId}/chat/clear`);
  }

  // Asks the model again after a reply failed.
  async retryReply(): Promise<void> {
    await this.#session.request<Ok>("POST", `/api/bots/${this.botId}/chat/retry`);
  }

  async changeSettings(change: ChatSettingsUpdate): Promise<void> {
    const settings = await this.#session.request<ChatSettings>("PATCH", `/api/bots/${this.botId}/chat/settings`, change);
    this.state.update((state) => ({ ...state, settings }));
  }

  // Loads the page of history before the oldest message shown.
  async loadEarlier(): Promise<void> {
    const { messages, hasEarlier } = this.state.get();
    const oldest = messages[0];
    if (!hasEarlier || oldest === undefined || this.#loadingEarlier) return;
    this.#loadingEarlier = true;
    try {
      const page = await this.#session.request<ChatHistoryPage>("GET", `/api/bots/${this.botId}/chat/history?before=${encodeURIComponent(oldest.id)}&limit=${HISTORY_PAGE}`);
      this.state.update((state) => applyHistoryPage(state, page));
    } finally {
      this.#loadingEarlier = false;
    }
  }

  async #post(requestId: string, text: string, mode: SendMode): Promise<void> {
    try {
      await this.#session.request<SendMessageResponse>("POST", `/api/bots/${this.botId}/chat/messages`, { text, mode, requestId });
    } catch (error) {
      this.state.update((state) => failPending(state, requestId, error instanceof Error ? error.message : "Couldn't send"));
    }
  }

  #receive(message: StreamMessage): void {
    if (message.type === "snapshot") {
      this.#dropWaitingLive();
      this.state.update((state) => applyChatSnapshot(state, message.snapshot as ChatSnapshot));
      return this.#markRead();
    }
    const events = (message.type === "catchup" ? message.events.map((item) => item.event) : [message.event]) as ChatEvent[];
    if (events.every((event) => event.type === "live")) return this.#holdLive(events.at(-1)!.live);
    this.#drawWaitingLive();
    this.state.update((state) => events.reduce(applyChatEvent, state));
    this.#markRead();
  }

  // Keeps only the newest live state and draws it shortly, so a burst of updates draws once.
  #holdLive(live: LiveState): void {
    this.#waitingLive = live;
    this.#liveTimer ??= setTimeout(() => this.#drawWaitingLive(), liveRedrawDelay(live));
  }

  #drawWaitingLive(): void {
    const live = this.#waitingLive;
    this.#dropWaitingLive();
    if (live !== undefined) this.state.update((state) => applyChatEvent(state, { type: "live", live }));
  }

  #dropWaitingLive(): void {
    clearTimeout(this.#liveTimer);
    this.#liveTimer = undefined;
    this.#waitingLive = undefined;
  }

  // While a screen shows the chat, moves the server's read marker to the newest message, so every device clears its unread count.
  #markRead(): void {
    const newest = newestTime(this.state.get());
    if (this.#watchers === 0 || newest <= this.#readUpTo) return;
    this.#readUpTo = newest;
    this.#session.request<Ok>("POST", `/api/bots/${this.botId}/read`, { upTo: newest }).catch(() => {
      this.#readUpTo = 0;
    });
  }

  #unwatch(): void {
    this.#watchers -= 1;
    if (this.#watchers > 0) return;
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    this.#dropWaitingLive();
  }
}

function newestTime(state: ChatState): number {
  return state.messages.reduce((newest, message) => ("at" in message && message.at !== null ? Math.max(newest, message.at) : newest), 0);
}

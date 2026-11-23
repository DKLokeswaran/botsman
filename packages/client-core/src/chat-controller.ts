import type { ChatEvent, ChatHistoryPage, ChatSettings, ChatSettingsUpdate, ChatSnapshot, LivePatch, LiveState, Ok, SendMessageResponse } from "@botsman/protocol";
import { chatStream } from "@botsman/protocol";
import { applyLivePatch, expectedHashes, hashesMatch, type TextHashes } from "./live-patch.ts";
import { addPending, applyChatEvent, applyChatSnapshot, applyHistoryPage, type ChatState, dropPending, emptyChat, failPending, markSent, withLive } from "./chat-state.ts";
import { defaultSendMode, type SendMode } from "./send-rule.ts";
import type { Session } from "./session.ts";
import { Store } from "./store.ts";
import type { StreamConnection, StreamMessage } from "./stream-connection.ts";

const HISTORY_PAGE = 50;
// Live patches folded since the last redraw, with the hashes their texts must have when drawn.
type WaitingLive = { live: LiveState; hashes: TextHashes };

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
  #waitingLive: WaitingLive | undefined;
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
    this.state.update((state) => addPending(state, { requestId, text, mode, sent: false, failed: undefined }));
    await this.#post(requestId, text, mode);
  }

  // Sends a failed message again under the same request id, so the server can't run it twice.
  async retry(requestId: string): Promise<void> {
    const send = this.state.get().pending.find((other) => other.requestId === requestId);
    if (send === undefined) return;
    this.state.update((state) => addPending(state, { ...send, sent: false, failed: undefined }));
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
      this.state.update((state) => markSent(state, requestId));
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
    if (events.length === 0) return;
    if (events.every((event) => event.type === "live_patch")) return this.#holdLive(events);
    if (this.#applyInOrder(events)) this.#markRead();
  }

  // Folds a burst of patches and draws them shortly, so the burst draws once.
  #holdLive(events: Extract<ChatEvent, { type: "live_patch" }>[]): void {
    if (!events.every((event) => this.#fold(event.patch))) return;
    this.#liveTimer ??= setTimeout(() => this.#drawWaitingLive(), liveRedrawDelay(this.#waitingLive!.live));
  }

  // Applies events in sequence order. A message, totals or settings event first draws the patches before it.
  #applyInOrder(events: ChatEvent[]): boolean {
    for (const event of events) {
      const applied = event.type === "live_patch" ? this.#fold(event.patch) : this.#drawWaitingLive() && this.#applyOther(event);
      if (!applied) return false;
    }
    return this.#drawWaitingLive();
  }

  #applyOther(event: ChatEvent): true {
    this.state.update((state) => applyChatEvent(state, event) ?? state);
    return true;
  }

  // Folds a patch onto the waiting state, or onto the state on screen when nothing waits. A patch that fails its
  // check keeps the screen as it is and asks for a fresh snapshot.
  #fold(patch: LivePatch): boolean {
    const live = applyLivePatch(this.#waitingLive?.live ?? this.state.get().live, patch);
    if (live === undefined) return this.#resync();
    this.#waitingLive = { live, hashes: expectedHashes(this.#waitingLive?.hashes ?? new Map(), patch) };
    return true;
  }

  // Draws the folded patches, once each changed text matches its hash.
  #drawWaitingLive(): boolean {
    const waiting = this.#waitingLive;
    this.#dropWaitingLive();
    if (waiting === undefined) return true;
    if (!hashesMatch(waiting.live, waiting.hashes)) return this.#resync();
    this.state.update((state) => withLive(state, waiting.live));
    return true;
  }

  #resync(): false {
    this.#dropWaitingLive();
    this.#connection.resync(chatStream(this.botId));
    return false;
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

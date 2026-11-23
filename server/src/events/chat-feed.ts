import { type ChatMessage, chatStream, type ChatSettings, type ChatSnapshot, type LiveState, type StreamEvent } from "@botsman/protocol";
import { toChatMessage, toLiveState, toTotals, type ViewDocs, type ViewEntry } from "./chat-view.ts";
import { diffLive, isEmptyPatch } from "./live-diff.ts";
import type { StreamHub } from "./stream-hub.ts";

type ChatState = {
  seen: Set<number>;
  // The live state as of the last live event, which every patch is relative to and every snapshot carries.
  published: LiveState;
  // False until the chat's first view is handled, so a failure already there after a restart doesn't alert again.
  firstViewSeen: boolean;
  totals: string;
  docs: ViewDocs;
  entries: readonly ViewEntry[];
};

const SNAPSHOT_MESSAGES = 50;
const IDLE: LiveState = toLiveState({}, new Map());

// Turns each new view of a chat into numbered events on the chat's stream: new messages, live state, and totals.
export class ChatFeed {
  readonly #hub: StreamHub<StreamEvent>;
  readonly #approvalsByCall: (botId: string) => ReadonlyMap<string, string>;
  readonly #onFailure: (botId: string, reason: string) => void;
  readonly #onMessage: (botId: string, message: ChatMessage) => void;
  readonly #chats = new Map<string, ChatState>();

  constructor(
    hub: StreamHub<StreamEvent>,
    approvalsByCall: (botId: string) => ReadonlyMap<string, string>,
    onFailure: (botId: string, reason: string) => void = () => {},
    onMessage: (botId: string, message: ChatMessage) => void = () => {},
  ) {
    this.#hub = hub;
    this.#approvalsByCall = approvalsByCall;
    this.#onFailure = onFailure;
    this.#onMessage = onMessage;
  }

  update(botId: string, view: { entries: readonly ViewEntry[]; docs: ViewDocs }): void {
    const chat = this.#chat(botId, view.entries);
    chat.docs = view.docs;
    chat.entries = view.entries;
    for (const entry of view.entries) {
      if (chat.seen.has(entry.id)) continue;
      chat.seen.add(entry.id);
      const message = toChatMessage(entry);
      if (message === undefined) continue;
      this.#publish(botId, { type: "message", message });
      this.#onMessage(botId, message);
    }
    this.refreshLive(botId);
    chat.firstViewSeen = true;
    const totals = toTotals(view.docs);
    const totalsJson = JSON.stringify(totals);
    if (totalsJson !== chat.totals) {
      chat.totals = totalsJson;
      this.#publish(botId, { type: "totals", totals });
    }
  }

  // Recomputes live state, for example when an approval for one of the chat's tool calls starts or ends, and sends
  // what changed at once. Pi commits streamed text and tool output at most every 100 ms each.
  refreshLive(botId: string): void {
    const chat = this.#chats.get(botId);
    if (chat === undefined) return;
    this.#publishLive(botId, chat, toLiveState(chat.docs, this.#approvalsByCall(botId)));
  }

  settingsChanged(botId: string, settings: ChatSettings): void {
    this.#publish(botId, { type: "settings", settings });
  }

  // Whether the chat's bot is replying or running tools right now.
  working(botId: string): boolean {
    const chat = this.#chats.get(botId);
    return chat !== undefined && toLiveState(chat.docs, new Map()).running;
  }

  // Every message the feed holds for a chat, oldest first.
  messages(botId: string): ChatMessage[] {
    return (this.#chats.get(botId)?.entries ?? []).flatMap((entry) => toChatMessage(entry) ?? []);
  }

  // The oldest transcript entry the feed holds for a chat, so a caller can ask the engine what came before it.
  firstEntryId(botId: string): number | undefined {
    return this.#chats.get(botId)?.entries[0]?.id;
  }

  // `earlierInTranscript` says whether the transcript has messages from before the entries the feed holds.
  snapshot(botId: string, settings: ChatSettings, earlierInTranscript = false): ChatSnapshot {
    const chat = this.#chats.get(botId);
    const all = this.messages(botId);
    const messages = all.slice(-SNAPSHOT_MESSAGES);
    return {
      botId,
      messages,
      hasEarlier: all.length > messages.length || earlierInTranscript,
      live: chat?.published ?? IDLE,
      totals: toTotals(chat?.docs ?? {}),
      settings,
    };
  }

  forget(botId: string): void {
    this.#chats.delete(botId);
  }

  #publishLive(botId: string, chat: ChatState, live: LiveState): void {
    const patch = diffLive(chat.published, live);
    if (isEmptyPatch(patch)) return;
    // A failure alerts once, when it appears. Stop records one as aborted, which never alerts.
    const newFailure = chat.firstViewSeen && chat.published.failure === null && live.failure !== null && live.failure.reason !== "aborted";
    chat.published = live;
    if (newFailure) this.#onFailure(botId, live.failure!.reason);
    this.#publish(botId, { type: "live_patch", patch });
  }

  // The first view of a chat marks its existing entries as seen, so a restart doesn't announce old messages again.
  #chat(botId: string, entries: readonly ViewEntry[]): ChatState {
    let chat = this.#chats.get(botId);
    if (chat === undefined) {
      chat = { seen: new Set(entries.map((entry) => entry.id)), published: IDLE, firstViewSeen: false, totals: "", docs: {}, entries };
      this.#chats.set(botId, chat);
    }
    return chat;
  }

  #publish(botId: string, event: StreamEvent): void {
    this.#hub.publish(chatStream(botId), event);
  }
}

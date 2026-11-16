import { chatStream, type ChatSettings, type ChatSnapshot, type StreamEvent } from "@botsman/protocol";
import { toChatMessage, toLiveState, toTotals, type ViewDocs, type ViewEntry } from "./chat-view.ts";
import type { StreamHub } from "./stream-hub.ts";

type ChatState = { seen: Set<number>; live: string; totals: string; docs: ViewDocs; entries: readonly ViewEntry[] };

const SNAPSHOT_MESSAGES = 50;

// Turns each new view of a chat into numbered events on the chat's stream: new messages, live state, and totals.
export class ChatFeed {
  readonly #hub: StreamHub<StreamEvent>;
  readonly #approvalsByCall: (botId: string) => ReadonlyMap<string, string>;
  readonly #onFailure: (botId: string, reason: string) => void;
  readonly #chats = new Map<string, ChatState>();

  constructor(
    hub: StreamHub<StreamEvent>,
    approvalsByCall: (botId: string) => ReadonlyMap<string, string>,
    onFailure: (botId: string, reason: string) => void = () => {},
  ) {
    this.#hub = hub;
    this.#approvalsByCall = approvalsByCall;
    this.#onFailure = onFailure;
  }

  update(botId: string, view: { entries: readonly ViewEntry[]; docs: ViewDocs }): void {
    const chat = this.#chat(botId, view.entries);
    chat.docs = view.docs;
    chat.entries = view.entries;
    for (const entry of view.entries) {
      if (chat.seen.has(entry.id)) continue;
      chat.seen.add(entry.id);
      const message = toChatMessage(entry);
      if (message !== undefined) this.#publish(botId, { type: "message", message });
    }
    this.refreshLive(botId);
    const totals = toTotals(view.docs);
    const totalsJson = JSON.stringify(totals);
    if (totalsJson !== chat.totals) {
      chat.totals = totalsJson;
      this.#publish(botId, { type: "totals", totals });
    }
  }

  // Recomputes live state, for example when an approval for one of the chat's tool calls starts or ends.
  refreshLive(botId: string): void {
    const chat = this.#chats.get(botId);
    if (chat === undefined) return;
    const live = toLiveState(chat.docs, this.#approvalsByCall(botId));
    const liveJson = JSON.stringify(live);
    if (liveJson === chat.live) return;
    // A failure alerts once, when it appears; the first view after a restart only records what is already there.
    const newFailure = chat.live !== "" && (JSON.parse(chat.live) as { failure: unknown }).failure === null && live.failure !== null;
    chat.live = liveJson;
    if (newFailure && live.failure!.reason !== "aborted") this.#onFailure(botId, live.failure!.reason);
    this.#publish(botId, { type: "live", live });
  }

  settingsChanged(botId: string, settings: ChatSettings): void {
    this.#publish(botId, { type: "settings", settings });
  }

  // The oldest transcript entry the feed holds for a chat, so a caller can ask the engine what came before it.
  firstEntryId(botId: string): number | undefined {
    return this.#chats.get(botId)?.entries[0]?.id;
  }

  // `earlierInTranscript` says whether the transcript has messages from before the entries the feed holds.
  snapshot(botId: string, settings: ChatSettings, earlierInTranscript = false): ChatSnapshot {
    const chat = this.#chats.get(botId);
    const entries = chat?.entries ?? [];
    const all = entries.flatMap((entry) => toChatMessage(entry) ?? []);
    const messages = all.slice(-SNAPSHOT_MESSAGES);
    return {
      botId,
      messages,
      hasEarlier: all.length > messages.length || earlierInTranscript,
      live: toLiveState(chat?.docs ?? {}, this.#approvalsByCall(botId)),
      totals: toTotals(chat?.docs ?? {}),
      settings,
    };
  }

  forget(botId: string): void {
    this.#chats.delete(botId);
  }

  // The first view of a chat marks its existing entries as seen, so a restart doesn't announce old messages again.
  #chat(botId: string, entries: readonly ViewEntry[]): ChatState {
    let chat = this.#chats.get(botId);
    if (chat === undefined) {
      chat = { seen: new Set(entries.map((entry) => entry.id)), live: "", totals: "", docs: {}, entries };
      this.#chats.set(botId, chat);
    }
    return chat;
  }

  #publish(botId: string, event: StreamEvent): void {
    this.#hub.publish(chatStream(botId), event);
  }
}

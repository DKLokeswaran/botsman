import { applyLivePatch, expectedHashes, hashesMatch } from "@botsman/client-core";
import { type ChatSnapshot, chatStream, type LiveState, type StreamEvent } from "@botsman/protocol";
import { describe, expect, it } from "vitest";
import { ChatFeed } from "../../src/events/chat-feed.ts";
import type { ViewEntry } from "../../src/events/chat-view.ts";
import { StreamHub } from "../../src/events/stream-hub.ts";

const BOT = "b1";
const settings = { model: null, thinkingLevel: "medium" as const };

// Pi's live document while a reply is written, with an optional failure.
function piLive(text: string | undefined, runFailure?: { reason: string }) {
  const generation = text === undefined ? undefined : { message: { content: [{ type: "text", text }] } };
  return { "pi.live": { ...(text === undefined ? {} : { run: {} }), generation, runFailure } };
}

const assistant = (id: number, text: string): ViewEntry => ({
  id,
  kind: "pi.assistant",
  model: [{ role: "assistant", content: [{ type: "text", text }], provider: "p", model: "m", usage: undefined, stopReason: "stop", timestamp: 1 } as never],
});

function feedWithEvents() {
  const hub = new StreamHub<StreamEvent>();
  const events: StreamEvent[] = [];
  const failures: string[] = [];
  hub.subscribe(chatStream(BOT), (item) => events.push(item.event));
  const feed = new ChatFeed(hub, () => new Map(), (_bot, reason) => failures.push(reason));
  return { feed, events, failures, patches: () => events.filter((event) => event.type === "live_patch") };
}

describe("chat feed", () => {
  it("sends one patch straight away for each view that changes the live state, and nothing otherwise", () => {
    const { feed, patches } = feedWithEvents();
    feed.update(BOT, { entries: [], docs: piLive("Hello") });
    expect(patches()).toHaveLength(1);
    feed.update(BOT, { entries: [], docs: piLive("Hello") });
    expect(patches()).toHaveLength(1);
    feed.update(BOT, { entries: [], docs: piLive("Hello, how") });
    expect(patches().at(-1)).toEqual({ type: "live_patch", patch: { streamingText: expect.objectContaining({ drop: 0, append: ", how" }) } });
  });

  it("sends a finished message before the patch that clears its preview", () => {
    const { feed, events } = feedWithEvents();
    feed.update(BOT, { entries: [], docs: piLive("Done") });
    feed.update(BOT, { entries: [assistant(1, "Done")], docs: piLive(undefined) });
    expect(events.slice(-2).map((event) => event.type)).toEqual(["message", "live_patch"]);
  });

  it("rebuilds Pi's live state exactly by folding every patch onto any snapshot", () => {
    const { feed, events } = feedWithEvents();
    const texts = ["He", "Hello", "Hello, how", "Hello, how are you"];
    feed.update(BOT, { entries: [], docs: piLive(texts[0]) });
    const snapshot: ChatSnapshot = feed.snapshot(BOT, settings);
    const from = events.length;
    for (const text of texts.slice(1)) feed.update(BOT, { entries: [], docs: piLive(text) });
    let live: LiveState | undefined = snapshot.live;
    for (const event of events.slice(from)) {
      if (event.type !== "live_patch") continue;
      live = applyLivePatch(live!, event.patch);
      expect(hashesMatch(live!, expectedHashes(new Map(), event.patch))).toBe(true);
    }
    expect(live?.streamingText).toBe("Hello, how are you");
    expect(feed.snapshot(BOT, settings).live).toEqual(live);
  });

  it("alerts a model failure once, never on Stop, and not for a failure already there at the first view", () => {
    const restarted = feedWithEvents();
    restarted.feed.update(BOT, { entries: [], docs: piLive(undefined, { reason: "model_error" }) });
    expect(restarted.failures).toEqual([]);

    const { feed, failures } = feedWithEvents();
    feed.update(BOT, { entries: [], docs: piLive("Hi") });
    feed.update(BOT, { entries: [], docs: piLive(undefined, { reason: "model_error" }) });
    feed.update(BOT, { entries: [], docs: piLive(undefined, { reason: "model_error" }) });
    expect(failures).toEqual(["model_error"]);
    feed.update(BOT, { entries: [], docs: piLive("Again") });
    feed.update(BOT, { entries: [], docs: piLive(undefined, { reason: "aborted" }) });
    expect(failures).toEqual(["model_error"]);
  });
});

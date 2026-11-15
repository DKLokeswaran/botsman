import { describe, expect, it } from "vitest";
import { StreamHub } from "../../src/events/stream-hub.ts";

describe("stream hub", () => {
  it("numbers events per stream and replays what a client missed", () => {
    const hub = new StreamHub<string>();
    hub.publish("a", "one");
    hub.publish("a", "two");
    hub.publish("b", "other");
    expect(hub.since("a", hub.epoch, 1)).toEqual([{ seq: 2, event: "two" }]);
    expect(hub.since("a", hub.epoch, 2)).toEqual([]);
  });

  it("asks for a snapshot after a restart or when events are gone", () => {
    const hub = new StreamHub<number>();
    for (let index = 0; index < 1200; index++) hub.publish("a", index);
    expect(hub.since("a", "old-epoch", 1199)).toBeUndefined();
    expect(hub.since("a", hub.epoch, 10)).toBeUndefined();
    expect(hub.since("a", hub.epoch, 1199)?.length).toBe(1);
  });
});

import type { Bot, DeviceSession, UsageReport } from "@botsman/protocol";
import { describe, expect, it } from "vitest";
import { exactCommand, liveSessions, slashMatches, usageBots, usageDays } from "../src/index.ts";

const zero = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0, cost: 0 };
const cost = (value: number) => ({ ...zero, cost: value });

describe("slash commands", () => {
  it("offers commands only while the message is one word starting with a slash", () => {
    expect(slashMatches("/")?.map((command) => command.name)).toEqual(["compact", "clear", "memory", "notes", "usage", "help"]);
    expect(slashMatches("/c")?.map((command) => command.name)).toContain("clear");
    expect(slashMatches("/clear now")).toBeUndefined();
    expect(slashMatches("hello")).toBeUndefined();
    expect(exactCommand(" /notes ")?.name).toBe("notes");
    expect(exactCommand("/note")).toBeUndefined();
  });
});

describe("usage view", () => {
  const report: UsageReport = {
    since: Date.UTC(2026, 10, 14),
    total: cost(6),
    days: [{ day: "2026-11-15", usage: cost(4) }, { day: "2026-11-16", usage: cost(2) }],
    bots: [{ botId: "a", usage: cost(4) }, { botId: "gone1", usage: cost(1) }, { botId: "gone2", usage: cost(1) }],
  };

  it("fills days without replies, and scales bars against the costliest day", () => {
    expect(usageDays(report, 3).map((day) => [day.day, day.share])).toEqual([["2026-11-14", 0], ["2026-11-15", 1], ["2026-11-16", 0.5]]);
  });

  it("adds deleted bots together", () => {
    expect(usageBots(report, [{ id: "a", name: "Atlas" } as Bot]).map((row) => [row.name, row.cost])).toEqual([["Atlas", 4], ["Deleted bots", 2]]);
  });
});

describe("signed-in devices", () => {
  const session = (id: string, lastUsedAt: number, change: Partial<DeviceSession> = {}): DeviceSession => ({ id, deviceName: id, createdAt: 0, lastUsedAt, expiresAt: 0, revokedAt: null, ...change });

  it("lists this device first, then by last use, and leaves out revoked ones", () => {
    const list = liveSessions([session("old", 1), session("revoked", 9, { revokedAt: 5 }), session("this", 0, { current: true }), session("recent", 5)]);
    expect(list.map((item) => item.id)).toEqual(["this", "recent", "old"]);
  });
});

import type { Bot, DeviceSession, UsageReport } from "@botsman/protocol";
import { describe, expect, it, test } from "vitest";
import { isThemeMode, resolveTheme, memoryDiff, chatFromCache, chatToCache, emptyChat, emptyServerState, serverFromCache, serverToCache, backgroundLine, backgroundSteps, exactCommand, liveSessions, slashMatches, usageBots, usageDays, opensOutside } from "../src/index.ts";

const zero = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0, cost: 0 };
const cost = (value: number) => ({ ...zero, cost: value });

describe("slash commands", () => {
  it("offers commands only while the message is one word starting with a slash", () => {
    expect(slashMatches("/")?.map((command) => command.name)).toEqual(["compact", "clear", "memory", "notes", "usage"]);
    expect(slashMatches("/c")?.map((command) => command.name)).toContain("clear");
    expect(slashMatches("/clear now")).toBeUndefined();
    expect(slashMatches("hello")).toBeUndefined();
    expect(exactCommand(" /notes ")?.name).toBe("notes");
    expect(exactCommand("/note")).toBeUndefined();
  });
});

test("only web and mail links open outside the app", () => {
  expect(["https://example.com", "http://example.com", "mailto:a@b.c"].every(opensOutside)).toBe(true);
  expect(["javascript:alert(1)", "file:///etc/passwd", "/app/settings", "#top"].some(opensOutside)).toBe(false);
});

describe("usage view", () => {
  const report: UsageReport = {
    since: Date.UTC(2026, 10, 14),
    total: cost(6),
    days: [{ day: "2026-11-15", usage: cost(4) }, { day: "2026-11-16", usage: cost(2) }],
    bots: [{ botId: "a", usage: cost(4) }, { botId: "gone1", usage: cost(1) }, { botId: "gone2", usage: cost(1) }],
  };

  // Runs a check with the device in a given timezone.
  const inZone = (zone: string, check: () => void) => {
    const before = process.env.TZ;
    process.env.TZ = zone;
    try {
      check();
    } finally {
      process.env.TZ = before;
    }
  };

  it("fills days without replies, and scales bars against the costliest day", () => {
    inZone("UTC", () => expect(usageDays(report, 3).map((day) => [day.day, day.share])).toEqual([["2026-11-14", 0], ["2026-11-15", 1], ["2026-11-16", 0.5]]));
  });

  it("names each column by the device's own date, even 13 hours ahead of UTC", () => {
    const auckland = { ...report, since: Date.UTC(2026, 10, 13, 11) };
    inZone("Pacific/Auckland", () => expect(usageDays(auckland, 3).map((day) => [day.day, day.cost])).toEqual([["2026-11-14", 0], ["2026-11-15", 4], ["2026-11-16", 2]]));
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

describe("background alerts checklist", () => {
  const status = { running: true, connected: true, notificationsAllowed: false, batteryUnrestricted: true, maker: "samsung" };

  it("asks for what's missing, and links a strict maker's guide", () => {
    expect(backgroundSteps("Botsman Preview", status).map((step) => [step.label, step.detail, step.action])).toEqual([
      ["Notifications", "Turned off for Botsman Preview", "notifications"],
      ["Battery", "Unrestricted", undefined],
      ["Phone maker", "Samsung can stop background apps. Its steps are on dontkillmyapp.com.", "guide"],
    ]);
    expect(backgroundSteps("Botsman", { ...status, maker: "google" }).map((step) => step.label)).not.toContain("Phone maker");
  });

  it("says how the connection is doing", () => {
    expect(backgroundLine(status, false)).toMatch(/^Off/);
    expect(backgroundLine(status, true)).toMatch(/^Connected/);
    expect(backgroundLine({ ...status, connected: false }, true)).toBe("Connecting…");
  });
});

describe("local cache", () => {
  it("shows the saved server state only while the live one is loading", () => {
    const saved = serverToCache({ ...emptyServerState, status: "ready", bots: [{ id: "a", name: "Atlas" } as Bot] });
    expect(serverFromCache(emptyServerState, saved)).toMatchObject({ status: "cached", bots: [{ id: "a" }] });
    expect(serverFromCache({ ...emptyServerState, status: "ready" }, saved).status).toBe("ready");
    expect(serverFromCache(emptyServerState, undefined)).toBe(emptyServerState);
  });

  it("keeps a chat's newest messages and says there are earlier ones", () => {
    const messages = Array.from({ length: 60 }, (_, index) => ({ type: "user" as const, id: String(index), at: null, text: `m${index}` }));
    const restored = chatFromCache(emptyChat, chatToCache({ ...emptyChat, status: "ready", messages }));
    expect(restored.status).toBe("cached");
    expect(restored.messages).toHaveLength(50);
    expect(restored.messages[0]?.id).toBe("10");
    expect(restored.hasEarlier).toBe(true);
  });
});

describe("memory edit diff", () => {
  it("shows added and removed lines with a little context around them", () => {
    const before = ["# Bot memory", "a", "b", "c", "d", "e", "f"].join("\n");
    const after = ["# Bot memory", "a", "b", "c", "d", "E changed", "f", "g"].join("\n");
    expect(memoryDiff(before, after)).toEqual([
      { kind: "same", text: "c" },
      { kind: "same", text: "d" },
      { kind: "removed", text: "e" },
      { kind: "added", text: "E changed" },
      { kind: "same", text: "f" },
      { kind: "added", text: "g" },
    ]);
  });

  it("shows every line as added for an empty file", () => {
    expect(memoryDiff("", "one\ntwo")).toEqual([{ kind: "added", text: "one" }, { kind: "added", text: "two" }]);
  });
});

describe("theme mode", () => {
  it("follows the device under System, and otherwise keeps the owner's choice", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(isThemeMode("sepia")).toBe(false);
  });
});

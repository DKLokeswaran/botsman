import type { Approval, Bot, DeviceSession, UsageReport } from "@botsman/protocol";
import { describe, expect, it, test } from "vitest";
import { isThemeMode, resolveTheme, memoryDiff, chatFromCache, chatToCache, emptyChat, emptyServerState, serverFromCache, serverToCache, backgroundLine, backgroundSteps, exactCommand, liveSessions, slashMatches, usageBots, usageDays, usageView, updateView, UPDATE_NEEDED, connectionLine, needsYouLine, memoryEditView, runFooter, modelChoices, type RunItem, botInitial, botNameProblem, noteNameProblem, permissionNote, isBusy, opensOutside } from "../src/index.ts";

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

describe("usage screen", () => {
  it("draws a short faded bar for a day that cost nothing, and sizes the rest", () => {
    const since = Date.now() - 14 * 24 * 3_600_000;
    const view = usageView({ since, total: cost(3), days: [], bots: [{ botId: "a", usage: cost(2) }, { botId: "b", usage: cost(1) }] }, [{ id: "a", name: "Atlas" }, { id: "b", name: "Bea" }] as Bot[]);
    expect(view.total).toBe("$3.00");
    expect(view.days).toHaveLength(14);
    expect(view.days[0]).toMatchObject({ height: "3%", opacity: 0.25, cost: "$0.00" });
    expect(view.bots).toEqual([{ name: "Atlas", cost: "$2.00", width: "100%" }, { name: "Bea", cost: "$1.00", width: "50%" }]);
  });
});

describe("app updates", () => {
  it("words each state, with the platform's own note while it installs", () => {
    expect(updateView({ status: "none" }, "0.1.0", "Note.")).toBeUndefined();
    expect(updateView({ status: "available", version: "0.2.0" }, "0.1.0", "Note.")).toMatchObject({ message: "Version 0.2.0 is ready to install. You're on 0.1.0.", install: "Install", error: undefined });
    expect(updateView({ status: "available", version: "0.2.0" }, undefined, "Note.")?.message).toBe("Version 0.2.0 is ready to install.");
    expect(updateView({ status: "installing", version: "0.2.0" }, "0.1.0", "Note.")).toMatchObject({ title: "Installing", message: "Installing 0.2.0. Note.", install: undefined });
    expect(updateView({ status: "failed", version: "0.2.0", error: "No space" }, "0.1.0", "Note.")).toMatchObject({ error: "No space", install: "Try again" });
  });

  it("names the side to update", () => {
    expect(UPDATE_NEEDED.update_server.title).toBe("Update the server");
  });
});

describe("bot list lines", () => {
  it("names the server's host while there is a connection to name", () => {
    expect(connectionLine("online", "https://bots.example.com:8443")).toBe("Connected to bots.example.com:8443");
    expect(connectionLine("reconnecting", "https://bots.example.com")).toBe("Reconnecting to bots.example.com…");
    expect([connectionLine("connecting", "https://a"), connectionLine("offline", "https://a")]).toEqual(["Connecting…", "Offline"]);
  });

  it("says which bot asks, and for what", () => {
    expect(needsYouLine({ memoryEdit: null }, "Atlas")).toBe("Atlas · Approval");
    expect(needsYouLine({ memoryEdit: { file: "BOT_MEMORY.md", previous: "", content: "x" } }, undefined)).toBe("Bot · Memory edit");
  });

  it("counts compacting as busy", () => {
    expect([isBusy({ running: false, compacting: true }), isBusy({ running: false, compacting: false })]).toEqual([true, false]);
  });
});

describe("memory edit card", () => {
  it("prefixes each changed line", () => {
    const approval = { createdAt: 0, memoryEdit: { file: "BOT_MEMORY.md", previous: "a\nb", content: "a\nc" } } as Approval;
    const view = memoryEditView(approval, "Atlas");
    expect(view.title).toBe("Atlas wants to change BOT_MEMORY.md");
    expect(view.lines.map((line) => line.text)).toEqual(["  a", "− b", "+ c"]);
  });
});

describe("run footer", () => {
  const run = { kind: "run", id: "r", at: null, steps: [], model: null, usage: null, error: null, working: false } as RunItem;

  it("shows what a finished run has, and nothing while it works or has neither", () => {
    expect(runFooter(run)).toBeUndefined();
    expect(runFooter({ ...run, steps: [{ kind: "text", id: "t", text: " hi " }] })).toEqual({ usage: undefined, copyText: "hi" });
    expect(runFooter({ ...run, working: true, steps: [{ kind: "text", id: "t", text: "hi" }] })).toBeUndefined();
  });
});

describe("bot forms", () => {
  const models = [{ provider: "a", id: "m1", name: "M1", contextWindow: 1, reasoning: false }, { provider: "b", id: "m1", name: "M1", contextWindow: 1, reasoning: false }];

  it("marks the model in use by its provider too", () => {
    expect(modelChoices(models, { provider: "b", modelId: "m1" })).toEqual([
      { key: "a/m1", label: "M1 · a", chosen: false, ref: { provider: "a", modelId: "m1" } },
      { key: "b/m1", label: "M1 · b", chosen: true, ref: { provider: "b", modelId: "m1" } },
    ]);
  });

  it("holds names to the protocol's rules", () => {
    expect(botNameProblem("a".repeat(60))).toBeUndefined();
    expect(botNameProblem("a".repeat(61))).toBe("Keep the name to 60 characters.");
    expect(["a/b", "a\\b", "a\nb"].map(botNameProblem)).toEqual(Array(3).fill("A name can't contain slashes or control characters."));
    expect(noteNameProblem("x")).toBe("Use 4 to 120 characters, ending in .md.");
    expect(noteNameProblem("a/b.md")).toMatch(/^Start with/);
    expect(noteNameProblem("plan 1.md")).toBeUndefined();
  });

  it("draws the initial in upper case, and says memory edits always ask", () => {
    expect(botInitial(" atlas")).toBe("A");
    expect(permissionNote("off")).toBe("Actions outside this bot's folder run without asking. Memory edits always ask, in every mode.");
  });
});

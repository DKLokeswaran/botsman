import { describe, expect, it } from "vitest";
import { openDatabase } from "../../src/store/database.ts";
import { UsageLog } from "../../src/usage/usage-log.ts";

const usage = (cost: number) => ({ inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 15, cost });

describe("usage log", () => {
  it("totals by day in the owner's timezone, and by bot with the costliest first", () => {
    const log = new UsageLog(openDatabase(":memory:"));
    const now = Date.UTC(2026, 10, 16, 12, 0);
    log.record("a", Date.UTC(2026, 10, 16, 1, 0), usage(1));
    log.record("b", Date.UTC(2026, 10, 15, 20, 0), usage(3));
    log.record("a", Date.UTC(2026, 10, 1, 0, 0), usage(100));

    const utc = log.report(2, 0, now);
    expect(utc.total.cost).toBe(4);
    expect(utc.days.map((day) => day.day)).toEqual(["2026-11-15", "2026-11-16"]);
    expect(utc.bots.map((bot) => bot.botId)).toEqual(["b", "a"]);

    // At UTC+05:30, 20:00 UTC on the 15th is already the 16th.
    const india = log.report(1, -330, now);
    expect(india.days).toEqual([{ day: "2026-11-16", usage: { ...usage(4), inputTokens: 20, outputTokens: 10, totalTokens: 30 } }]);
  });

  it("reports zeros when nothing was recorded", () => {
    expect(new UsageLog(openDatabase(":memory:")).report(30, 0).total.totalTokens).toBe(0);
  });
});

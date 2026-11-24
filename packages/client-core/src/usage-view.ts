import type { Bot, UsageReport } from "@botsman/protocol";
import { formatCost } from "./format.ts";

const DAY_MS = 24 * 3_600_000;

// The days the usage screen covers.
export const USAGE_DAYS = 14;

// A day's bar is never shorter than this, and a day that cost nothing is drawn faded.
const SHORTEST_BAR = 3;
const FADED = 0.25;

// The usage screen: the total, a bar per day with the dates under its ends, and a meter per bot, all ready to draw.
export type UsageView = {
  total: string;
  days: { day: string; label: string; cost: string; height: Percent; opacity: number }[];
  ends: { first: string | undefined; last: string | undefined };
  bots: { name: string; cost: string; width: Percent }[];
  // Whether no bot replied in the period. A period of free replies isn't empty.
  empty: boolean;
};

type Percent = `${number}%`;

export function usageView(report: UsageReport, bots: readonly Bot[]): UsageView {
  const days = usageDays(report, USAGE_DAYS);
  return {
    total: formatCost(report.total.cost),
    days: days.map(({ day, label, cost, share }) => ({ day, label, cost: formatCost(cost), height: `${Math.max(SHORTEST_BAR, percent(share))}%`, opacity: cost === 0 ? FADED : 1 })),
    ends: { first: days[0]?.label, last: days.at(-1)?.label },
    bots: usageBots(report, bots).map(({ name, cost, share }) => ({ name, cost: formatCost(cost), width: `${percent(share)}%` })),
    empty: report.bots.length === 0,
  };
}

function percent(share: number): number {
  return Math.round(share * 100);
}

export type UsageDay = { day: string; label: string; cost: number; share: number };
export type UsageBot = { name: string; cost: number; share: number };

// Every day in the report's period, oldest first, with days that had no replies at zero. `share` is against the
// costliest day, for bar heights. The server names days by the device's own calendar, so each column is the device's
// local date at noon of that day.
export function usageDays(report: UsageReport, days: number): UsageDay[] {
  const costs = new Map(report.days.map((entry) => [entry.day, entry.usage.cost]));
  const list = Array.from({ length: days }, (_, index) => {
    const date = new Date(report.since + index * DAY_MS + DAY_MS / 2);
    const day = localDay(date);
    return { day, label: date.toLocaleDateString(undefined, { day: "numeric", month: "short" }), cost: costs.get(day) ?? 0 };
  });
  const most = Math.max(0, ...list.map((entry) => entry.cost));
  return list.map((entry) => ({ ...entry, share: most === 0 ? 0 : entry.cost / most }));
}

function localDay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Spending by bot, costliest first, with deleted bots added together under one line.
export function usageBots(report: UsageReport, bots: readonly Bot[]): UsageBot[] {
  const names = new Map(bots.map((bot) => [bot.id, bot.name]));
  const live = report.bots.filter((entry) => names.has(entry.botId)).map((entry) => ({ name: names.get(entry.botId)!, cost: entry.usage.cost }));
  const gone = report.bots.filter((entry) => !names.has(entry.botId)).reduce((sum, entry) => sum + entry.usage.cost, 0);
  const rows = gone > 0 ? [...live, { name: "Deleted bots", cost: gone }] : live;
  const most = Math.max(0, ...rows.map((row) => row.cost));
  return rows.map((row) => ({ ...row, share: most === 0 ? 0 : row.cost / most }));
}

import type { Bot, BotActivity, ChatMessage, ChatSettings, ModelInfo, Usage } from "@botsman/protocol";
import { sameModel } from "./bot-settings.ts";
import { shownEffort } from "./providers.ts";

// Time left until a moment, as `47:10`, or `1:02:05` past an hour. Never below zero.
export function formatCountdown(until: number, now: number): string {
  const seconds = Math.max(0, Math.ceil((until - now) / 1000));
  const two = (value: number) => String(value).padStart(2, "0");
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds % 60)}` : `${minutes}:${two(seconds % 60)}`;
}

// A cost in dollars: cents for ordinary amounts, more digits for a reply that cost less than a cent.
export function formatCost(cost: number): string {
  if (cost === 0) return "$0.00";
  return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`;
}

export function formatTokens(tokens: number): string {
  if (tokens < 1000) return String(tokens);
  return tokens < 1_000_000 ? `${(tokens / 1000).toFixed(1)}k` : `${(tokens / 1_000_000).toFixed(2)}M`;
}

// The line under a finished reply: its tokens and what it cost.
export function formatUsage(usage: Usage): string {
  return `${formatTokens(usage.totalTokens)} tokens · ${formatCost(usage.cost)}`;
}

// The line under a chat's title: the model, the reasoning effort it really runs at, how full the context is, and the
// chat's total cost.
export function chatSubtitle(settings: ChatSettings, totalCost: number, models: readonly ModelInfo[] = [], contextTokens = 0): string {
  const model = settings.model === null ? "No model chosen" : settings.model.modelId;
  const info = models.find((candidate) => sameModel(candidate, settings.model));
  const context = info === undefined || info.contextWindow === 0 ? [] : [`${Math.round((contextTokens / info.contextWindow) * 100)}% context`];
  return [model, effortLabel(shownEffort(info, settings.thinkingLevel)), ...context, `${formatCost(totalCost)} this chat`].join(" · ");
}

// The tokens the chat's context holds now: everything the newest reply's request carried, plus what it wrote. A clear
// or compaction starts it again.
export function contextTokens(messages: readonly ChatMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]!;
    if (message.type === "notice" && (message.kind === "reset" || message.kind === "compaction")) return 0;
    if (message.type === "assistant" && message.usage !== null && message.usage.totalTokens > 0) return message.usage.totalTokens;
  }
  return 0;
}

export function effortLabel(level: Bot["thinkingLevel"]): string {
  if (level === "xhigh") return "Extra high";
  if (level === "max") return "Max";
  return level.charAt(0).toUpperCase() + level.slice(1);
}

const DAY_MS = 24 * 3_600_000;

// When a message was written, as a chat shows it: the time for today, "Yesterday", or the date before that.
export function formatMessageTime(at: number, now: number): string {
  const days = Math.floor(startOfDay(now) / DAY_MS) - Math.floor(startOfDay(at) / DAY_MS);
  if (days <= 0) return new Date(at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  return new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// What a bot list row shows: the newest message or else the bot's purpose, when the chat last moved, and the unread badge.
export function botRowText(description: string, activity: BotActivity | undefined, now: number): { subtitle: string; time: string; unread: string } {
  return {
    subtitle: activity?.preview || description,
    time: activity?.lastAt == null ? "" : formatMessageTime(activity.lastAt, now),
    unread: formatUnread(activity?.unread ?? 0),
  };
}

// An unread count as a badge shows it, or empty when nothing is unread.
export function formatUnread(count: number): string {
  if (count <= 0) return "";
  return count > 99 ? "99+" : String(count);
}

// Midnight of a moment's day, in local time, shifted so whole days divide evenly.
function startOfDay(time: number): number {
  const date = new Date(time);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

// A size on disk, such as "41.2 GB".
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`;
}

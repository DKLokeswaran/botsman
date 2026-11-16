import type { Bot, ChatSettings, Usage } from "@botsman/protocol";

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

// The line under a chat's title: the model, the reasoning effort, and the chat's total cost.
export function chatSubtitle(settings: ChatSettings, totalCost: number): string {
  const model = settings.model === null ? "No model chosen" : settings.model.modelId;
  return `${model} · ${effortLabel(settings.thinkingLevel)} · ${formatCost(totalCost)} this chat`;
}

export function effortLabel(level: Bot["thinkingLevel"]): string {
  if (level === "xhigh") return "Extra high";
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

// Midnight of a moment's day, in local time, shifted so whole days divide evenly.
function startOfDay(time: number): number {
  const date = new Date(time);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

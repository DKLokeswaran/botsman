import type { Approval, Bot } from "@botsman/protocol";
import { botRowText, connectionLine, formatCountdown, needsYouLine } from "../format.ts";
import { useBotsmanClient } from "./client-context.tsx";
import { useBot, useBotActivity, useConnectionStatus, useNeedsYou } from "./use-server-state.ts";
import { useNow } from "./use-now.ts";

const ROW_REFRESH_MS = 60_000;

// One bot's row in the bot list, and whether the bot waits for the owner.
export function useBotRow(bot: Bot) {
  const needsYou = useNeedsYou().some((approval) => approval.botId === bot.id);
  return { ...botRowText(bot.description, useBotActivity(bot.id), useNow(ROW_REFRESH_MS)), needsYou };
}

// One approval's row in the Needs you list: who asks for what, and the time left to answer.
export function useNeedsYouRow(approval: Approval): { line: string; countdown: string } {
  const bot = useBot(approval.botId);
  return { line: needsYouLine(approval, bot?.name), countdown: formatCountdown(approval.expiresAt, useNow()) };
}

// The line under the bot list that says how the connection is doing.
export function useConnectionLine(): string {
  return connectionLine(useConnectionStatus(), useBotsmanClient().baseUrl);
}

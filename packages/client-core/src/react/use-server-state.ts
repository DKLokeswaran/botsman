import type { Approval, Bot, BotActivity } from "@botsman/protocol";
import { useMemo, useSyncExternalStore } from "react";
import { type ServerState, sortBots } from "../server-state.ts";
import type { Store } from "../store.ts";
import type { ConnectionStatus } from "../stream-connection.ts";
import type { UpdateChecker, UpdateInfo, UpdateState } from "../updates.ts";
import { useBotsmanClient } from "./client-context.tsx";

// Re-renders a screen whenever a store's value changes.
export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function useConnectionStatus(): ConnectionStatus {
  return useStore(useBotsmanClient().connection.status);
}

export function useServerState(): ServerState {
  return useStore(useBotsmanClient().server);
}

// The bots in list order: the main bot, then the most recently active.
export function useBots(): Bot[] {
  const { bots, activity } = useServerState();
  return useMemo(() => sortBots(bots, activity), [bots, activity]);
}

// A bot's line in the bot list, or undefined before the server has sent it.
export function useBotActivity(botId: string): BotActivity | undefined {
  return useServerState().activity[botId];
}

// What is waiting for the owner, oldest first.
export function useNeedsYou(): Approval[] {
  return useServerState().approvals;
}

export function useBot(botId: string): Bot | undefined {
  return useBots().find((bot) => bot.id === botId);
}

// The approval a tool call is waiting on, once the server has sent it.
export function useApproval(approvalId: string | undefined): Approval | undefined {
  return useNeedsYou().find((approval) => approval.id === approvalId);
}

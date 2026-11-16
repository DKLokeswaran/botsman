import type { Approval, Bot, BotActivity } from "@botsman/protocol";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { ChatController } from "../chat-controller.ts";
import { type ChatItem, chatItems } from "../chat-items.ts";
import type { ChatState } from "../chat-state.ts";
import { offeredSendModes, type SendMode } from "../send-rule.ts";
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

export type ChatView = { chat: ChatController; state: ChatState; items: ChatItem[]; sendModes: SendMode[] };

// One bot's chat, followed for as long as the screen showing it is mounted.
export function useChat(botId: string): ChatView {
  const client = useBotsmanClient();
  const chat = useMemo(() => client.chat(botId), [client, botId]);
  useEffect(() => chat.watch(), [chat]);
  const state = useStore(chat.state);
  const items = useMemo(() => chatItems(state), [state]);
  const sendModes = useMemo(() => offeredSendModes(state.live), [state.live]);
  return { chat, state, items, sendModes };
}

export function useBot(botId: string): Bot | undefined {
  return useBots().find((bot) => bot.id === botId);
}

// The approval a tool call is waiting on, once the server has sent it.
export function useApproval(approvalId: string | undefined): Approval | undefined {
  return useNeedsYou().find((approval) => approval.id === approvalId);
}

const NO_UPDATE: UpdateState = { status: "none" };
const NO_INFO: UpdateInfo = { installed: undefined, checking: false, checkedAt: undefined, error: undefined };
const neverChanges = () => () => {};

// A value of the app's update checker. An app that doesn't update itself always gets the fallback.
function useCheckerValue<T>(store: Store<T> | undefined, fallback: T): T {
  return useSyncExternalStore(store?.subscribe ?? neverChanges, store?.get ?? (() => fallback), () => fallback);
}

// The installed version and how the last update check went.
export function useUpdateInfo(updates: UpdateChecker | undefined): UpdateInfo {
  return useCheckerValue(updates?.info, NO_INFO);
}

// The version the owner said "Not now" to.
export function useDeclinedUpdate(updates: UpdateChecker | undefined): string | undefined {
  return useCheckerValue(updates?.declined, undefined);
}

// The state of the app's own update.
export function useUpdateState(updates: UpdateChecker | undefined): UpdateState {
  return useCheckerValue(updates?.state, NO_UPDATE);
}

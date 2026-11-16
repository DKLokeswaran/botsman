import type { Approval, Bot } from "@botsman/protocol";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { ChatController } from "../chat-controller.ts";
import type { ChatState } from "../chat-state.ts";
import { offeredSendModes, type SendMode } from "../send-rule.ts";
import type { ServerState } from "../server-state.ts";
import type { SessionState } from "../session.ts";
import type { Store } from "../store.ts";
import type { ConnectionStatus } from "../stream-connection.ts";
import { useBotsmanClient } from "./client-context.tsx";

// Re-renders a screen whenever a store's value changes.
export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function useSession(): SessionState {
  return useStore(useBotsmanClient().session.state);
}

export function useConnectionStatus(): ConnectionStatus {
  return useStore(useBotsmanClient().connection.status);
}

export function useServerState(): ServerState {
  return useStore(useBotsmanClient().server);
}

export function useBots(): Bot[] {
  return useServerState().bots;
}

// What is waiting for the owner, oldest first.
export function useNeedsYou(): Approval[] {
  return useServerState().approvals;
}

export type ChatView = { chat: ChatController; state: ChatState; sendModes: SendMode[] };

// One bot's chat, followed for as long as the screen showing it is mounted.
export function useChat(botId: string): ChatView {
  const client = useBotsmanClient();
  const chat = useMemo(() => client.chat(botId), [client, botId]);
  useEffect(() => chat.watch(), [chat]);
  const state = useStore(chat.state);
  const sendModes = useMemo(() => offeredSendModes(state.live), [state.live]);
  return { chat, state, sendModes };
}

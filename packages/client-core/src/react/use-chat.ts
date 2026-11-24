import { useEffect, useMemo } from "react";
import type { ChatController } from "../chat-controller.ts";
import { type ChatItem, chatItems } from "../chat-items.ts";
import type { ChatState } from "../chat-state.ts";
import { chatSubtitle, contextTokens } from "../format.ts";
import { modelProblem } from "../providers.ts";
import { isBusy, offeredSendModes, type SendMode } from "../send-rule.ts";
import { useBotsmanClient } from "./client-context.tsx";
import { useConnectionStatus, useStore } from "./use-server-state.ts";
import { useModels } from "./use-models.ts";

export type ChatView = {
  chat: ChatController;
  state: ChatState;
  items: ChatItem[];
  sendModes: SendMode[];
  busy: boolean;
  reconnecting: boolean;
  subtitle: string;
  // Why the chat can't run, once its settings and the models have loaded.
  problem: string | undefined;
};

// One bot's chat, followed for as long as the screen showing it is mounted.
export function useChat(botId: string): ChatView {
  const client = useBotsmanClient();
  const chat = useMemo(() => client.chat(botId), [client, botId]);
  useEffect(() => chat.watch(), [chat]);
  const state = useStore(chat.state);
  const items = useMemo(() => chatItems(state), [state]);
  const sendModes = useMemo(() => offeredSendModes(state.live), [state.live]);
  const reconnecting = useConnectionStatus() === "reconnecting";
  const { models, loading } = useModels();
  return {
    chat,
    state,
    items,
    sendModes,
    busy: isBusy(state.live),
    reconnecting,
    subtitle: chatSubtitle(state.settings, state.totals.usage.cost, models, contextTokens(state.messages)),
    problem: loading || state.status === "loading" ? undefined : modelProblem(models, state.settings.model),
  };
}

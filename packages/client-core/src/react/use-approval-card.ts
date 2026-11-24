import type { Approval, ApprovalAnswer } from "@botsman/protocol";
import { useMemo } from "react";
import { formatCountdown } from "../format.ts";
import { memoryEditView } from "../memory-diff.ts";
import { useBotsmanClient } from "./client-context.tsx";
import { useBot } from "./hooks.ts";
import { useAction } from "./use-action.ts";
import { useNow } from "./use-now.ts";

// An approval's card: the time left to answer, and answering it.
export function useApprovalCard(approval: Approval) {
  const client = useBotsmanClient();
  const answer = useAction((decision: ApprovalAnswer["decision"]) => client.answerApproval(approval.id, decision));
  return { countdown: formatCountdown(approval.expiresAt, useNow()), answer };
}

// A memory edit's card: the approval's, with what the edit changes. The change is worked out once, not on every second
// of the countdown.
export function useMemoryEditCard(approval: Approval) {
  const card = useApprovalCard(approval);
  const botName = useBot(approval.botId)?.name ?? "The bot";
  const view = useMemo(() => memoryEditView(approval, botName), [approval, botName]);
  return { ...card, ...view };
}

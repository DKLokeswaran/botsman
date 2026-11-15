import { arr, int, nullable, obj, oneOf, opt, type Static, str } from "@earendil-works/pi-schema";
import { MemoryEdit } from "./memory.ts";

export const ApprovalStatuses = ["pending", "allowed", "denied", "expired", "cancelled"] as const;
export const ApprovalDecisions = ["allow_once", "allow_chat", "deny"] as const;

// A tool call waiting for the owner, with why the bot asks and the full call.
// A memory edit carries the file, the new content and the current content, and can only be allowed once.
export const Approval = obj({
  id: str(),
  botId: str(),
  conversation: str(),
  toolName: str(),
  reason: str(),
  description: str(),
  command: str(),
  memoryEdit: nullable(MemoryEdit),
  status: oneOf(ApprovalStatuses),
  decision: nullable(oneOf(ApprovalDecisions)),
  createdAt: int(),
  expiresAt: int(),
  answeredAt: nullable(int()),
});
export type Approval = Static<typeof Approval>;

export const ApprovalList = obj({ approvals: arr(Approval) });
export type ApprovalList = Static<typeof ApprovalList>;

export const ApprovalListQuery = obj({ status: opt(oneOf(ApprovalStatuses)), botId: opt(str()) });
export type ApprovalListQuery = Static<typeof ApprovalListQuery>;

export const ApprovalAnswer = obj({ decision: oneOf(ApprovalDecisions) });
export type ApprovalAnswer = Static<typeof ApprovalAnswer>;

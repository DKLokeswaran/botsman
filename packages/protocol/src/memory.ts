import { arr, int, nullable, obj, oneOf, opt, type Static, str } from "@earendil-works/pi-schema";

export const MemoryFileNames = ["USER_PROFILE.md", "USER_MEMORY.md", "BOT_PROFILE.md", "BOT_MEMORY.md"] as const;
export const MemoryFileName = oneOf(MemoryFileNames);
export type MemoryFileName = Static<typeof MemoryFileName>;

// Character limits for each memory file.
export const MemoryLimits: Record<MemoryFileName, number> = {
  "USER_PROFILE.md": 4000,
  "USER_MEMORY.md": 2000,
  "BOT_PROFILE.md": 6000,
  "BOT_MEMORY.md": 4000,
};

export const MemoryFile = obj({
  name: MemoryFileName,
  content: str(),
  limit: int(),
  writtenBy: oneOf(["owner", "main_bot", "bot"]),
});
export type MemoryFile = Static<typeof MemoryFile>;

export const MemoryFiles = obj({ botId: str(), files: arr(MemoryFile) });
export type MemoryFiles = Static<typeof MemoryFiles>;

export const MemoryFileParams = obj({ id: str({ minLength: 1 }), file: MemoryFileName });
export type MemoryFileParams = Static<typeof MemoryFileParams>;

export const MemoryFileUpdate = obj({ content: str({ maxLength: 6000 }) });
export type MemoryFileUpdate = Static<typeof MemoryFileUpdate>;

export const ProposalStatuses = ["pending", "accepted", "rejected", "refused"] as const;

// A bot's proposed edit to a memory file, waiting for the owner's confirmation.
export const MemoryProposal = obj({
  id: str(),
  botId: str(),
  file: MemoryFileName,
  content: str(),
  previous: str(),
  reason: str(),
  conversation: str(),
  status: oneOf(ProposalStatuses),
  createdAt: int(),
  answeredAt: nullable(int()),
});
export type MemoryProposal = Static<typeof MemoryProposal>;

export const MemoryProposalList = obj({ proposals: arr(MemoryProposal) });
export type MemoryProposalList = Static<typeof MemoryProposalList>;

export const ProposalListQuery = obj({ status: opt(oneOf(ProposalStatuses)), botId: opt(str()) });
export type ProposalListQuery = Static<typeof ProposalListQuery>;

export const ProposalAnswer = obj({ decision: oneOf(["accept", "reject"]) });
export type ProposalAnswer = Static<typeof ProposalAnswer>;

import { defineDoc } from "@earendil-works/pi-durable";
import type { MemorySnapshot } from "../memory/memory-files.ts";

// Per conversation: the frozen memory section, what the model has been told about the files since, and when.
export type MemoryState = {
  frozen: string;
  seen: MemorySnapshot | null;
  // The first entry of the active context when the section was frozen; it changes after compaction or a reset.
  head: string | null;
  lastSentAt: number;
};

export const MemoryDoc = defineDoc<MemoryState>({
  kind: "botsman.memory",
  version: 1,
  scope: "conversation",
  history: "latest",
  fork: "initial",
  initial: () => ({ frozen: "", seen: null, head: null, lastSentAt: 0 }),
  checkpointWhen: () => true,
});

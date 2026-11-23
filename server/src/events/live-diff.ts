import { type LivePatch, type LiveState, type LiveTool, type TextChange, textHash, type ToolPatch } from "@botsman/protocol";
import { overlap } from "@earendil-works/chord/delta";

// How far back into the old text the shared part is looked for, as Pi's own string diff does.
const OVERLAP_SCAN = 65_536;

// What changed between two live states. Identical states give an empty patch.
export function diffLive(previous: LiveState, next: LiveState): LivePatch {
  const patch: LivePatch = {};
  if (previous.running !== next.running) patch.running = next.running;
  if (previous.compacting !== next.compacting) patch.compacting = next.compacting;
  if (!sameJson(previous.failure, next.failure)) patch.failure = next.failure;
  if (!sameJson(previous.queued, next.queued)) patch.queued = next.queued;
  if (previous.streamingText !== next.streamingText) patch.streamingText = diffText(previous.streamingText, next.streamingText);
  if (previous.streamingThinking !== next.streamingThinking) patch.streamingThinking = diffText(previous.streamingThinking, next.streamingThinking);
  return { ...patch, ...diffTools(previous.tools, next.tools) };
}

export function isEmptyPatch(patch: LivePatch): boolean {
  return Object.keys(patch).length === 0;
}

// How one text became another: what's cut from its start, then what's added at its end. The shared part is found
// with Chord's overlap(), as Pi does when it commits a changed string. When none is found, the whole text goes.
export function diffText(previous: string, next: string): TextChange {
  const shared = next.startsWith(previous) ? previous.length : overlap(previous, next, OVERLAP_SCAN);
  return { drop: previous.length - shared, append: next.slice(shared), length: next.length, hash: textHash(next) };
}

// Only the tools that changed. Unless the tools last sent start the new list in the same order, the list is cleared
// and sent whole.
function diffTools(previous: LiveTool[], next: LiveTool[]): Pick<LivePatch, "tools" | "toolsCleared"> {
  const keepsOrder = previous.every((tool, index) => next[index]?.callId === tool.callId);
  const base = keepsOrder ? previous : [];
  const tools = next.flatMap((tool, index) => diffTool(base[index], tool) ?? []);
  return { ...(keepsOrder ? {} : { toolsCleared: true as const }), ...(tools.length > 0 ? { tools } : {}) };
}

function diffTool(before: LiveTool | undefined, tool: LiveTool): ToolPatch | undefined {
  const known = before ?? { callId: tool.callId, name: undefined, status: undefined, awaitingApproval: undefined, output: "" };
  const patch: ToolPatch = { callId: tool.callId };
  if (known.name !== tool.name) patch.name = tool.name;
  if (known.status !== tool.status) patch.status = tool.status;
  if (known.awaitingApproval !== tool.awaitingApproval) patch.awaitingApproval = tool.awaitingApproval;
  if (known.output !== tool.output) patch.output = diffText(known.output, tool.output);
  return Object.keys(patch).length > 1 ? patch : undefined;
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

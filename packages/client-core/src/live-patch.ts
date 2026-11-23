import { type LivePatch, type LiveState, type LiveTool, type TextChange, textHash, type ToolPatch } from "@botsman/protocol";

// Which text a hash describes: the reply, its thinking, or one running tool's output.
export type TextHashes = ReadonlyMap<string, number>;

// Applies a patch, checking each text change's start and length. A patch that doesn't fit gives undefined.
export function applyLivePatch(live: LiveState, patch: LivePatch): LiveState | undefined {
  const { streamingText, streamingThinking, tools, toolsCleared, ...plain } = patch;
  const nextTools = applyTools(toolsCleared ? [] : live.tools, tools ?? []);
  const text = applyOptionalText(live.streamingText, streamingText);
  const thinking = applyOptionalText(live.streamingThinking, streamingThinking);
  if (nextTools === undefined || text === undefined || thinking === undefined) return undefined;
  return { ...live, ...plain, streamingText: text, streamingThinking: thinking, tools: nextTools };
}

// The hashes the texts must have after this patch, on top of those expected before it.
export function expectedHashes(hashes: TextHashes, patch: LivePatch): TextHashes {
  const next = new Map(patch.toolsCleared ? [...hashes].filter(([key]) => !key.startsWith("tool:")) : hashes);
  if (patch.streamingText) next.set("text", patch.streamingText.hash);
  if (patch.streamingThinking) next.set("thinking", patch.streamingThinking.hash);
  for (const tool of patch.tools ?? []) if (tool.output) next.set(`tool:${tool.callId}`, tool.output.hash);
  return next;
}

// Whether each text a patch changed hashes to what the server sent.
export function hashesMatch(live: LiveState, hashes: TextHashes): boolean {
  return [...hashes].every(([key, hash]) => {
    const text = hashedText(live, key);
    return text !== undefined && textHash(text) === hash;
  });
}

function hashedText(live: LiveState, key: string): string | undefined {
  if (key === "text") return live.streamingText;
  if (key === "thinking") return live.streamingThinking;
  return live.tools.find((tool) => `tool:${tool.callId}` === key)?.output;
}

function applyOptionalText(text: string, change: TextChange | undefined): string | undefined {
  return change === undefined ? text : applyText(text, change);
}

function applyText(text: string, change: TextChange): string | undefined {
  if (change.drop > text.length) return undefined;
  const next = text.slice(change.drop) + change.append;
  return next.length === change.length ? next : undefined;
}

function applyTools(tools: LiveTool[], changes: ToolPatch[]): LiveTool[] | undefined {
  let next: LiveTool[] | undefined = tools;
  for (const change of changes) next = next === undefined ? undefined : applyTool(next, change);
  return next;
}

// A known call id updates that tool. An unknown one is a new tool at the end, and must come with its name and status.
function applyTool(tools: LiveTool[], change: ToolPatch): LiveTool[] | undefined {
  const { output, ...fields } = change;
  const index = tools.findIndex((tool) => tool.callId === change.callId);
  if (index === -1 && (fields.name === undefined || fields.status === undefined)) return undefined;
  const before = tools[index] ?? { callId: change.callId, name: "", status: "pending", awaitingApproval: null, output: "" };
  const text = applyOptionalText(before.output, output);
  if (text === undefined) return undefined;
  const tool = { ...before, ...fields, output: text };
  return index === -1 ? [...tools, tool] : tools.map((other, at) => (at === index ? tool : other));
}

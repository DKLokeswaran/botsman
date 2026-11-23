import { describe, expect, it } from "vitest";
import { type LiveState, textHash } from "@botsman/protocol";
import { applyLivePatch, expectedHashes, hashesMatch } from "../src/index.ts";

const idle: LiveState = { running: false, streamingText: "", streamingThinking: "", tools: [], queued: [], compacting: false, failure: null };
const change = (drop: number, append: string, result: string) => ({ drop, append, length: result.length, hash: textHash(result) });

describe("applying a live patch", () => {
  it("cuts from the start, then adds at the end", () => {
    const live = applyLivePatch({ ...idle, streamingText: "line 0\nline 1\n" }, { streamingText: change(7, "line 2\n", "line 1\nline 2\n") });
    expect(live?.streamingText).toBe("line 1\nline 2\n");
  });

  it("fails the check when the cut or the length doesn't fit the text it lands on", () => {
    expect(applyLivePatch({ ...idle, streamingText: "Hi" }, { streamingText: change(5, "", "") })).toBeUndefined();
    expect(applyLivePatch({ ...idle, streamingText: "Hello, how" }, { streamingText: change(0, ", how", "Hello, how") })).toBeUndefined();
  });

  it("catches a wrong text of the right length with the hash", () => {
    const patch = { streamingText: change(7, "line 4\n", "line 2\nline 3\nline 4\n") };
    const applied = applyLivePatch({ ...idle, streamingText: "line 1\nLINE 2\nline 3\n" }, patch)!;
    expect(applied.streamingText).toHaveLength(patch.streamingText.length);
    expect(hashesMatch(applied, expectedHashes(new Map(), patch))).toBe(false);
  });

  it("adds a new tool with its output starting empty, after clearing the old round", () => {
    const round = { ...idle, tools: [{ callId: "c1", name: "read", status: "done" as const, output: "x", awaitingApproval: null }] };
    const live = applyLivePatch(round, { toolsCleared: true, tools: [{ callId: "c2", name: "bash", status: "running", awaitingApproval: null, output: change(0, "ok\n", "ok\n") }] });
    expect(live?.tools).toEqual([{ callId: "c2", name: "bash", status: "running", output: "ok\n", awaitingApproval: null }]);
  });

  it("fails the check on an unknown call id without a name", () => {
    expect(applyLivePatch(idle, { tools: [{ callId: "c1", status: "running" }] })).toBeUndefined();
  });
});

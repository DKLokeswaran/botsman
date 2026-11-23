import { describe, expect, it } from "vitest";
import { applyLivePatch, expectedHashes, hashesMatch } from "@botsman/client-core";
import { type LiveState, type LiveTool, textHash } from "@botsman/protocol";
import { diffLive, diffText, isEmptyPatch } from "../../src/events/live-diff.ts";

const idle: LiveState = { running: false, streamingText: "", streamingThinking: "", tools: [], queued: [], compacting: false, failure: null };
const tool = (callId: string, fields: Partial<LiveTool> = {}): LiveTool => ({ callId, name: "bash", status: "pending", output: "", awaitingApproval: null, ...fields });

// Applying the diff from a to b must give b exactly, with every hash matching.
function roundTrip(a: LiveState, b: LiveState) {
  const patch = diffLive(a, b);
  const applied = applyLivePatch(a, patch);
  expect(applied).toEqual(b);
  expect(hashesMatch(applied!, expectedHashes(new Map(), patch))).toBe(true);
  return patch;
}

const lines = (from: number, to: number) => Array.from({ length: to - from }, (_, index) => `line ${from + index}\n`).join("");

describe("text changes", () => {
  it("send only what grows at the end", () => {
    const patch = roundTrip({ ...idle, streamingText: "Hello, how" }, { ...idle, streamingText: "Hello, how are you" });
    expect(patch).toEqual({ streamingText: { drop: 0, append: " are you", length: 18, hash: textHash("Hello, how are you") } });
  });

  it("drop from the front and grow, as a sliding window does", () => {
    const patch = roundTrip({ ...idle, streamingText: lines(0, 4) }, { ...idle, streamingText: lines(1, 5) });
    expect(patch.streamingText).toMatchObject({ drop: 7, append: "line 4\n" });
  });

  it("clear, start from empty, and change completely", () => {
    expect(roundTrip({ ...idle, streamingText: "Hello" }, idle).streamingText).toMatchObject({ drop: 5, append: "" });
    roundTrip(idle, { ...idle, streamingThinking: "thinking" });
    expect(roundTrip({ ...idle, streamingText: "abc" }, { ...idle, streamingText: "xyz" }).streamingText).toMatchObject({ drop: 3, append: "xyz" });
  });

  it("round-trip emoji", () => {
    roundTrip({ ...idle, streamingText: "hi 👋" }, { ...idle, streamingText: "hi 👋 there 🎉" });
  });

  it("stay exact on a window of identical lines", () => {
    const same = "same line\n".repeat(200);
    roundTrip({ ...idle, streamingText: same }, { ...idle, streamingText: same.slice(10) + "other\n" });
  });

  it("send the whole text when its start repeats too often to find, as Pi's own diff does", () => {
    const before = "same line\n".repeat(200) + lines(0, 20);
    const after = before.slice(200) + lines(20, 21);
    expect(diffText(before, after)).toMatchObject({ drop: before.length, append: after });
    roundTrip({ ...idle, streamingText: before }, { ...idle, streamingText: after });
  });

  it("handle a short overlap", () => {
    expect(diffText("abcdef", "defgh")).toMatchObject({ drop: 3, append: "gh" });
  });

  it("fail the check on the wrong base", () => {
    const patch = diffLive({ ...idle, streamingText: "Hello" }, { ...idle, streamingText: "Hello, how" });
    expect(applyLivePatch({ ...idle, streamingText: "Hello, how" }, patch)).toBeUndefined();
    expect(applyLivePatch({ ...idle, streamingText: "Hi" }, patch)).toBeUndefined();
  });

  it("catch a wrong text of the right length with the hash", () => {
    const patch = diffLive({ ...idle, streamingText: lines(0, 4) }, { ...idle, streamingText: lines(1, 5) });
    const wrongBase = { ...idle, streamingText: lines(0, 3) + "LINE 3\n" };
    const applied = applyLivePatch(wrongBase, patch)!;
    expect(applied.streamingText.length).toBe(patch.streamingText!.length);
    expect(hashesMatch(applied, expectedHashes(new Map(), patch))).toBe(false);
  });
});

describe("tools", () => {
  it("send a new round whole, then only changed fields", () => {
    const round = { ...idle, running: true, tools: [tool("c1", { name: "read" }), tool("c2")] };
    expect(roundTrip({ ...idle, running: true }, round).tools).toEqual([
      { callId: "c1", name: "read", status: "pending", awaitingApproval: null },
      { callId: "c2", name: "bash", status: "pending", awaitingApproval: null },
    ]);
    const asked = { ...round, tools: [tool("c1", { name: "read", awaitingApproval: "a7" }), tool("c2")] };
    expect(roundTrip(round, asked)).toEqual({ tools: [{ callId: "c1", awaitingApproval: "a7" }] });
    const printed = { ...asked, tools: [asked.tools[0]!, tool("c2", { status: "running", output: "ok\n" })] };
    expect(roundTrip(asked, printed).tools).toEqual([{ callId: "c2", status: "running", output: { drop: 0, append: "ok\n", length: 3, hash: textHash("ok\n") } }]);
    expect(roundTrip(printed, { ...printed, tools: [] })).toEqual({ toolsCleared: true });
  });

  it("slide a tool's output", () => {
    roundTrip({ ...idle, tools: [tool("c1", { output: lines(0, 4) })] }, { ...idle, tools: [tool("c1", { output: lines(1, 5) })] });
  });

  it("replace one list with another, reorder it, or insert into it", () => {
    expect(roundTrip({ ...idle, tools: [tool("c1"), tool("c2")] }, { ...idle, tools: [tool("c3")] }).toolsCleared).toBe(true);
    roundTrip({ ...idle, tools: [tool("c1"), tool("c2")] }, { ...idle, tools: [tool("c2"), tool("c1")] });
    roundTrip({ ...idle, tools: [tool("c1"), tool("c2")] }, { ...idle, tools: [tool("c1"), tool("c9"), tool("c2")] });
  });
});

describe("other fields", () => {
  it("send the queue and a failure when they change", () => {
    roundTrip(idle, { ...idle, queued: [{ id: "1", text: "later", mode: "queue" }] });
    const failed = { ...idle, failure: { reason: "model_error", detail: "boom" } };
    expect(roundTrip(idle, failed)).toEqual({ failure: failed.failure });
    expect(roundTrip(failed, idle)).toEqual({ failure: null });
  });

  it("give an empty patch for identical states", () => {
    const state = { ...idle, running: true, streamingText: "x", tools: [tool("c1")] };
    expect(isEmptyPatch(diffLive(state, structuredClone(state)))).toBe(true);
  });
});

import type { ChatMessage } from "@botsman/protocol";
import { describe, expect, it } from "vitest";
import { botActivity } from "../../src/bots/bot-activity.ts";

const user = (id: string, at: number, text: string): ChatMessage => ({ type: "user", id, at, text });
const reply = (id: string, at: number, text: string): ChatMessage => ({
  type: "assistant", id, at, text, thinking: "", toolCalls: [], model: null, usage: null, stopReason: "stop", error: null,
});

describe("bot activity", () => {
  it("counts only replies after the read marker, and previews the newest message with text", () => {
    const messages = [user("1", 100, "hi"), reply("2", 200, "hello"), reply("3", 300, "  line one\n\nline two "), reply("4", 400, "")];
    expect(botActivity("b", messages, 150)).toEqual({ botId: "b", lastAt: 400, preview: "line one line two", unread: 2 });
    expect(botActivity("b", messages, 300).unread).toBe(0);
  });

  it("shortens a long preview, and leaves an empty chat blank", () => {
    expect(botActivity("b", [user("1", 1, "x".repeat(200))], 0).preview).toHaveLength(140);
    expect(botActivity("b", [], 0)).toEqual({ botId: "b", lastAt: null, preview: "", unread: 0 });
  });
});

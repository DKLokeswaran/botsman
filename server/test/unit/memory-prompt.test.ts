import { describe, expect, it } from "vitest";
import { memoryChangeText, renderMemorySection } from "../../src/memory/prompt.ts";

const files = { "USER_PROFILE.md": "Owner: Lokes", "USER_MEMORY.md": "", "BOT_PROFILE.md": "Be brief.", "BOT_MEMORY.md": "Likes tea." };

describe("memory prompt", () => {
  it("renders all four files", () => {
    const section = renderMemorySection(files);
    for (const name of Object.keys(files)) expect(section).toContain(`## ${name}`);
    expect(section).toContain("(empty)");
  });

  it("describes only the files that changed", () => {
    expect(memoryChangeText(files, files)).toBe("");
    const text = memoryChangeText(files, { ...files, "BOT_MEMORY.md": "Likes coffee." });
    expect(text).toContain("BOT_MEMORY.md changed");
    expect(text).toContain("Likes coffee.");
    expect(text).not.toContain("USER_PROFILE.md");
  });
});

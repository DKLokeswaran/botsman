import { expect, it } from "vitest";
import { textHash } from "../src/index.ts";

it("hashes UTF-16 units with FNV-1a", () => {
  expect(textHash("")).toBe(0x811c9dc5);
  expect(textHash("a")).toBe(0xe40c292c);
});

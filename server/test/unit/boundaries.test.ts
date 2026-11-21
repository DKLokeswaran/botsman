import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.join(import.meta.dirname, "../../src");

// AGENTS.md: pin Pi to an exact version. Which modules may import Pi is checked by `pnpm lint:imports`.
describe("module boundaries", () => {
  it("pins every Pi package to an exact version", () => {
    const pkg = JSON.parse(readFileSync(path.join(SRC, "../package.json"), "utf8")) as { dependencies: Record<string, string> };
    const pi = Object.entries(pkg.dependencies).filter(([name]) => name.startsWith("@earendil-works/"));
    expect(pi.length).toBeGreaterThan(0);
    for (const [, version] of pi) expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

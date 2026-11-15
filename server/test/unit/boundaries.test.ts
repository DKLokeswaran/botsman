import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.join(import.meta.dirname, "../../src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(full) : entry.name.endsWith(".ts") ? [full] : [];
  });
}

// AGENTS.md: only one internal server module may import Pi Durable.
describe("module boundaries", () => {
  it("only the engine imports Pi Durable", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => !file.startsWith(path.join(SRC, "engine") + path.sep))
      .filter((file) => /from\s+["']@earendil-works\/pi-durable/.test(readFileSync(file, "utf8")));
    expect(offenders.map((file) => path.relative(SRC, file))).toEqual([]);
  });

  it("pins every Pi package to an exact version", () => {
    const pkg = JSON.parse(readFileSync(path.join(SRC, "../package.json"), "utf8")) as { dependencies: Record<string, string> };
    const pi = Object.entries(pkg.dependencies).filter(([name]) => name.startsWith("@earendil-works/"));
    expect(pi.length).toBeGreaterThan(0);
    for (const [, version] of pi) expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

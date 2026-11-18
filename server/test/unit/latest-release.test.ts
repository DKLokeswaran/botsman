import { describe, expect, it } from "vitest";
import { LatestRelease, newestServerVersion } from "../../src/release/latest-release.ts";
import { SERVER_VERSION } from "../../src/release/server-version.ts";

describe("server releases", () => {
  it("picks the newest server-v tag by its numbers, and ignores other tags", () => {
    const refs = ["refs/tags/server-v0.9.0", "refs/tags/server-v0.10.0", "refs/tags/android-v2.0.0", "refs/tags/server-v1.0.0-rc", ""];
    expect(newestServerVersion(refs)).toBe("0.10.0");
    expect(newestServerVersion([])).toBeUndefined();
  });

  it("keeps the last answer when a check fails", async () => {
    let fail = false;
    const latest = new LatestRelease(async () => (fail ? Promise.reject(new Error("offline")) : ["refs/tags/server-v0.2.0"]));
    await latest.check();
    fail = true;
    await latest.check();
    expect(latest.version).toBe("0.2.0");
  });

  it("reads its own version from server/package.json", () => {
    expect(SERVER_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

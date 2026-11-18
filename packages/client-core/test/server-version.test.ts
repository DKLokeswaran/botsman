import type { Health } from "@botsman/protocol";
import { describe, expect, it } from "vitest";
import { serverUpdate, serverUpdateText, serverVersionLine } from "../src/index.ts";

const health = (fields: Partial<Health>): Health => ({ ok: true, version: "0.2.0", protocol: { oldest: 1, current: 1 }, sandbox: { ok: true, reason: null }, ...fields });

describe("server version", () => {
  it("names the branch and commit a preview server runs", () => {
    expect(serverVersionLine(health({}))).toBe("Server 0.2.0");
    expect(serverVersionLine(health({ preview: true, branch: "fix-login", commit: "abc1234" }))).toBe("Server 0.2.0 · Preview of fix-login at abc1234");
    expect(serverVersionLine(health({ preview: true }))).toBe("Server 0.2.0 · Preview");
  });

  it("offers a newer release, but never to a preview server", () => {
    expect(serverUpdate(health({ latestVersion: "0.10.0" }))).toBe("0.10.0");
    expect(serverUpdate(health({ latestVersion: "0.2.0" }))).toBeUndefined();
    expect(serverUpdate(health({}))).toBeUndefined();
    expect(serverUpdate(health({ latestVersion: "0.3.0", preview: true }))).toBeUndefined();
  });

  it("says where to run the update", () => {
    expect(serverUpdateText("0.3.0")).toBe("Server 0.3.0 is available. To update, run this in the Botsman folder on the server:");
    expect(serverUpdateText(undefined)).toBe("To update, run this in the Botsman folder on the server:");
  });
});

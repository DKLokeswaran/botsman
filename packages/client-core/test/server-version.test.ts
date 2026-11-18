import type { Health } from "@botsman/protocol";
import { describe, expect, it } from "vitest";
import { serverUpdate, serverUpdateSteps, serverVersionLine } from "../src/index.ts";

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

  it("gives the command that updates the server", () => {
    expect(serverUpdateSteps(health({ latestVersion: "0.3.0" }))).toEqual({ text: "Server 0.3.0 is available. To update, run this in the Botsman folder on the server:", command: "deploy/install.sh" });
    expect(serverUpdateSteps(undefined)).toEqual({ text: "To update, run this in the Botsman folder on the server:", command: "deploy/install.sh" });
  });

  it("tells a preview server to move to its branch's newest commit, never to the real server's release", () => {
    expect(serverUpdateSteps(health({ preview: true, branch: "fix-login", latestVersion: "0.3.0" })).command).toBe("deploy/install.sh --preview fix-login");
    expect(serverUpdateSteps(health({ preview: true })).command).toBe("deploy/install.sh --preview <branch>");
  });

  it("quotes a branch name that the shell would split or run", () => {
    expect(serverUpdateSteps(health({ preview: true, branch: "feature/a.b-c_d" })).command).toBe("deploy/install.sh --preview feature/a.b-c_d");
    expect(serverUpdateSteps(health({ preview: true, branch: "x; id" })).command).toBe("deploy/install.sh --preview 'x; id'");
    expect(serverUpdateSteps(health({ preview: true, branch: "it's$(id)" })).command).toBe("deploy/install.sh --preview 'it'\\''s$(id)'");
  });
});

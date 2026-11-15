import { mkdirSync, symlinkSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.ts";
import { ApprovalStore } from "../../src/permissions/approval-store.ts";
import { checkBoundary } from "../../src/permissions/boundary.ts";
import { openDatabase } from "../../src/store/database.ts";
import { tempRoot } from "../helpers.ts";

describe("folder boundary for file tools", () => {
  const roots: ReturnType<typeof tempRoot>[] = [];
  afterEach(() => roots.splice(0).forEach((root) => root.cleanup()));

  function folder(): string {
    const root = tempRoot();
    roots.push(root);
    const dir = path.join(root.root, "bot");
    mkdirSync(dir);
    return dir;
  }

  it("treats a leading @ the way Pi does", () => {
    const dir = folder();
    expect(checkBoundary("read", { path: "@/etc/hostname" }, dir).leaves).toBe(true);
    expect(checkBoundary("read", { path: "@notes.md" }, dir).leaves).toBe(false);
  });

  it.each([["file:///etc/hostname"], ["~/etc-link/hostname"], ["etc\u00A0link/hostname"], ["it's/hostname"]])("resolves %s the way Pi does", (requested) => {
    const dir = folder();
    symlinkSync("/etc", path.join(dir, "etc-link"));
    symlinkSync("/etc", path.join(dir, "etc link"));
    symlinkSync("/etc", path.join(dir, "it\u2019s"));
    expect(checkBoundary("read", { path: requested }, dir).leaves).toBe(true);
  });

  it("keeps paths inside the folder inside, whatever their spelling", () => {
    const dir = folder();
    expect(checkBoundary("read", { path: "~/notes.md" }, dir).leaves).toBe(false);
    expect(checkBoundary("write", { path: `file://${dir}/a.txt` }, dir).leaves).toBe(false);
  });

  it("follows a symlink inside the folder to where it points", () => {
    const dir = folder();
    symlinkSync("/etc", path.join(dir, "etc-link"));
    expect(checkBoundary("read", { path: "etc-link/hostname" }, dir).leaves).toBe(true);
  });
});

describe("approval list", () => {
  it("finds an old pending approval behind more than 500 newer ones", () => {
    const root = tempRoot();
    const db = openDatabase(path.join(root.root, "server.db"));
    let now = 0;
    const store = new ApprovalStore(db, () => now++);
    const request = { botId: "b1", conversation: "chat:b1", callId: "c", toolName: "read", args: {}, reason: "", description: "", command: "", memoryEdit: null, waitMs: 60_000 };
    const pending = store.create(request);
    for (let index = 0; index < 501; index++) store.settle(store.create(request).id, { status: "denied", decision: "deny" });
    expect(store.list({ status: "pending", botIds: ["b1"] }).map((approval) => approval.id)).toEqual([pending.id]);
    db.close();
    root.cleanup();
  });
});

describe("settings", () => {
  it("refuses number settings that are not whole numbers in range", () => {
    expect(() => loadConfig({ BOTSMAN_BACKUP_HOUR: "3am" })).toThrow("BOTSMAN_BACKUP_HOUR");
    expect(() => loadConfig({ BOTSMAN_BACKUP_KEEP: "0" })).toThrow("BOTSMAN_BACKUP_KEEP");
    expect(() => loadConfig({ BOTSMAN_PORT: "70000" })).toThrow("BOTSMAN_PORT");
    expect(() => loadConfig({ BOTSMAN_PORT: " " })).toThrow("BOTSMAN_PORT");
    expect(() => loadConfig({ BOTSMAN_PORT: "0x10" })).toThrow("BOTSMAN_PORT");
    expect(() => loadConfig({ BOTSMAN_BACKUP_KEEP: "1e2" })).toThrow("BOTSMAN_BACKUP_KEEP");
    expect(loadConfig({ BOTSMAN_BACKUP_HOUR: "23" }).backupHour).toBe(23);
  });
});

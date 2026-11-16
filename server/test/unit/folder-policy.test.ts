import { mkdirSync, symlinkSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkFolder } from "../../src/bots/folder-policy.ts";
import { tempRoot } from "../helpers.ts";

describe("bot folder rules", () => {
  const roots: ReturnType<typeof tempRoot>[] = [];
  afterEach(() => roots.splice(0).forEach((root) => root.cleanup()));

  function rules() {
    const root = tempRoot();
    roots.push(root);
    const other = path.join(root.root, "other-bot");
    mkdirSync(other, { recursive: true });
    return {
      root,
      rules: { homeDir: root.home, dataDir: root.dataDir, backupDir: path.join(root.root, "backups"), defaultFolder: path.join(root.dataDir, "workspaces", "b1"), otherBotFolders: [other] },
    };
  }

  it.each([
    ["/", "root folder"],
    ["{home}", "home folder"],
    ["{root}", "home folder"],
    ["{home}/.ssh", "sensitive"],
    ["{home}/.claude/projects", "sensitive"],
    ["{home}/.agents", "sensitive"],
    ["{home}/.botsman/bots", "Botsman's own data"],
    ["{home}/.botsman/workspaces/other", "Botsman's own data"],
    ["{root}/other-bot/sub", "another bot"],
    ["{root}/backups", "backups"],
    ["{root}/backups/2026-11-15", "backups"],
  ])("refuses %s", (template, reason) => {
    const { root, rules: folderRules } = rules();
    const requested = template.replace("{home}", root.home).replace("{root}", root.root);
    const check = checkFolder(requested, folderRules);
    expect(check.allowed).toBe(false);
    if (!check.allowed) expect(check.reason).toContain(reason);
  });

  it("allows the bot's default folder and folders elsewhere", () => {
    const { root, rules: folderRules } = rules();
    expect(checkFolder(folderRules.defaultFolder, folderRules).allowed).toBe(true);
    expect(checkFolder(path.join(root.home, "projects", "with space"), folderRules).allowed).toBe(true);
    expect(checkFolder(path.join(root.root, "disk2", "repos"), folderRules).allowed).toBe(true);
  });

  it("follows symbolic links to where a folder really is", () => {
    const { root, rules: folderRules } = rules();
    mkdirSync(path.join(root.home, ".ssh"));
    symlinkSync(path.join(root.home, ".ssh"), path.join(root.root, "innocent"));
    expect(checkFolder(path.join(root.root, "innocent"), folderRules).allowed).toBe(false);
  });

  it("requires an absolute path", () => {
    expect(checkFolder("relative/path", rules().rules).allowed).toBe(false);
  });

  it("reads ~ as the owner's home folder", () => {
    const { root, rules: folderRules } = rules();
    expect(checkFolder("~", folderRules)).toMatchObject({ allowed: false, reason: expect.stringMatching(/home folder/) });
    expect(checkFolder("~/.ssh", folderRules)).toMatchObject({ allowed: false, reason: expect.stringMatching(/sensitive/) });
    expect(checkFolder("~/projects/notes", folderRules)).toMatchObject({ allowed: true, path: path.join(root.home, "projects", "notes") });
  });
});

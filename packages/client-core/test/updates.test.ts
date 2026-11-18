import { expect, test } from "vitest";
import { type AppUpdater, asksToUpdate, compareVersions, isOffered, UpdateChecker, versionLine } from "../src/index.ts";

const server = { oldest: 1, current: 2 };

function updater(latest: { version: string; protocol: number } | undefined, install: () => Promise<void> = async () => {}): AppUpdater {
  return { installedVersion: async () => "0.2.0", latest: async () => (latest === undefined ? undefined : { ...latest, install }) };
}

test("compares versions by their numbers, not as text", () => {
  expect(compareVersions("0.10.0", "0.9.9")).toBeGreaterThan(0);
  expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
  expect(compareVersions("0.2.0", "0.2.1")).toBeLessThan(0);
});

test("offers the next preview build over the installed one, whatever version its branch states", () => {
  expect(isOffered({ version: "0.0.10-preview+0.2.0.abc1234", protocol: 2 }, "0.0.9-preview+0.2.0.def5678", server)).toBe(true);
  expect(isOffered({ version: "0.0.61-preview+0.2.0.abc1234", protocol: 2 }, "0.0.60-preview+0.3.0.def5678", server)).toBe(true);
  expect(isOffered({ version: "0.0.9-preview+0.2.0.abc1234", protocol: 2 }, "0.0.9-preview+0.2.0.def5678", server)).toBe(false);
});

test("offers a newer build only when the server speaks its protocol", () => {
  expect(isOffered({ version: "0.3.0", protocol: 2 }, "0.2.0", server)).toBe(true);
  expect(isOffered({ version: "0.3.0", protocol: 3 }, "0.2.0", server)).toBe(false);
  expect(isOffered({ version: "0.2.0", protocol: 2 }, "0.2.0", server)).toBe(false);
  expect(isOffered({ version: "0.3.0", protocol: 9 }, "0.2.0", undefined)).toBe(true);
});

test("reports an available update, then installs it", async () => {
  let installed = false;
  const updates = new UpdateChecker(updater({ version: "0.3.0", protocol: 1 }, async () => void (installed = true)));
  await updates.check(server);
  expect(updates.state.get()).toEqual({ status: "available", version: "0.3.0" });
  await updates.install();
  expect(installed).toBe(true);
});

test("keeps the reason when an install fails, and reports none when nothing is newer", async () => {
  const failing = new UpdateChecker(updater({ version: "0.3.0", protocol: 1 }, async () => Promise.reject(new Error("The download doesn't match the release"))));
  await failing.check(server);
  await failing.install();
  expect(failing.state.get()).toEqual({ status: "failed", version: "0.3.0", error: "The download doesn't match the release" });

  const current = new UpdateChecker(updater(undefined));
  await current.check(server);
  expect(current.state.get()).toEqual({ status: "none" });
});

test("a check that can't reach the release host changes nothing", async () => {
  const offline = new UpdateChecker({ installedVersion: async () => "0.2.0", latest: async () => Promise.reject(new Error("offline")) });
  await offline.check(server);
  expect(offline.state.get()).toEqual({ status: "none" });
});

test("checks again on request, finds a build published since, and says when it last checked", async () => {
  let latest: { version: string; protocol: number } | undefined;
  const updates = new UpdateChecker({ installedVersion: async () => "0.2.0", latest: async () => (latest === undefined ? undefined : { ...latest, install: async () => {} }) });
  await updates.check(server);
  expect(updates.state.get()).toEqual({ status: "none" });
  expect(versionLine(updates.info.get(), updates.state.get())).toMatch(/^Botsman 0\.2\.0 · Up to date, checked at /);
  latest = { version: "0.2.1", protocol: 2 };
  await updates.checkNow();
  expect(updates.state.get()).toEqual({ status: "available", version: "0.2.1" });
  expect(versionLine(updates.info.get(), updates.state.get())).toBe("Botsman 0.2.0 · Version 0.2.1 is available");
});

test("a failed check says why and keeps any offer it had", async () => {
  let fail = false;
  const updates = new UpdateChecker({
    installedVersion: async () => "0.2.0",
    latest: async () => {
      if (fail) throw new Error("offline");
      return { version: "0.3.0", protocol: 2, install: async () => {} };
    },
  });
  await updates.check(server);
  fail = true;
  await updates.checkNow();
  expect(updates.state.get()).toEqual({ status: "available", version: "0.3.0" });
  expect(updates.info.get().error).toBe("offline");
  expect(versionLine(updates.info.get(), updates.state.get())).toBe("Botsman 0.2.0 · Couldn't check: offline");
});

test("the dialog asks once per version: Not now hides it until a newer build", async () => {
  let latest = { version: "0.3.0", protocol: 2 };
  const updates = new UpdateChecker({ installedVersion: async () => "0.2.0", latest: async () => ({ ...latest, install: async () => {} }) });
  await updates.check(server);
  expect(asksToUpdate(updates.state.get(), updates.declined.get())).toBe(true);
  updates.notNow();
  expect(asksToUpdate(updates.state.get(), updates.declined.get())).toBe(false);
  latest = { version: "0.3.1", protocol: 2 };
  await updates.checkNow();
  expect(asksToUpdate(updates.state.get(), updates.declined.get())).toBe(true);
});

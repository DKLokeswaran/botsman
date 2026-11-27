import { useSyncExternalStore } from "react";
import type { Store } from "../store.ts";
import { asksToUpdate, type UpdateChecker, type UpdateInfo, type UpdateState, type UpdateView, updateView, versionLine } from "../updates.ts";
import { useAppName } from "./app-name-context.tsx";

// The "Update available" dialog, or undefined when it has nothing to ask. `installingNote` says what the platform does
// while it installs.
export function useUpdateDialog(updates: UpdateChecker | undefined, installingNote: string): UpdateView | undefined {
  const state = useUpdateState(updates);
  const declined = useDeclinedUpdate(updates);
  const { installed } = useUpdateInfo(updates);
  return asksToUpdate(state, declined) ? updateView(state, installed, installingNote) : undefined;
}

// The notice that a newer build is ready, or undefined when the app is current.
export function useUpdateNotice(updates: UpdateChecker | undefined): UpdateView | undefined {
  return updateView(useUpdateState(updates), undefined, "");
}

// The version row in settings: its line, and whether the owner can check for updates now.
export function useAppVersion(updates: UpdateChecker | undefined): { line: string; canCheck: boolean } {
  const appName = useAppName();
  const info = useUpdateInfo(updates);
  const state = useUpdateState(updates);
  return { line: versionLine(appName, info, state), canCheck: !info.checking && state.status !== "installing" };
}

const NO_UPDATE: UpdateState = { status: "none" };
const NO_INFO: UpdateInfo = { installed: undefined, checking: false, checkedAt: undefined, error: undefined };
const neverChanges = () => () => {};

// A value of the app's update checker. An app that doesn't update itself always gets the fallback.
function useCheckerValue<T>(store: Store<T> | undefined, fallback: T): T {
  return useSyncExternalStore(store?.subscribe ?? neverChanges, store?.get ?? (() => fallback), () => fallback);
}

// The installed version and how the last update check went.
function useUpdateInfo(updates: UpdateChecker | undefined): UpdateInfo {
  return useCheckerValue(updates?.info, NO_INFO);
}

// The version the owner said "Not now" to.
function useDeclinedUpdate(updates: UpdateChecker | undefined): string | undefined {
  return useCheckerValue(updates?.declined, undefined);
}

// The state of the app's own update.
function useUpdateState(updates: UpdateChecker | undefined): UpdateState {
  return useCheckerValue(updates?.state, NO_UPDATE);
}

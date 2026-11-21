import type { AppEnvironment } from "@botsman/pc-ui";

const KEY = "botsman.server";

// The server address from last time. It is not a secret, so it stays in the window's own storage.
export const savedServer: NonNullable<AppEnvironment["savedServer"]> = {
  load: async () => localStorage.getItem(KEY) ?? undefined,
  save: async (address) => localStorage.setItem(KEY, address),
  clear: async () => localStorage.removeItem(KEY),
};

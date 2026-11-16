import type { AppEnvironment, TokenStore } from "@botsman/client-core";
import type { Tokens } from "@botsman/protocol";
import * as SecureStore from "expo-secure-store";
import { BotsmanAlerts } from "../modules/botsman-alerts";
import { backgroundAlerts } from "./background-alerts";
import { updater } from "./updater";

const TOKENS_KEY = "botsman.tokens";
const SERVER_KEY = "botsman.server";

// The session's tokens, encrypted with a key from the Android Keystore.
const tokenStore: TokenStore = {
  load: async () => {
    const stored = await SecureStore.getItemAsync(TOKENS_KEY);
    return stored === null ? undefined : (JSON.parse(stored) as Tokens);
  },
  save: (tokens) => SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify(tokens)),
  clear: () => SecureStore.deleteItemAsync(TOKENS_KEY),
};

const savedServer: NonNullable<AppEnvironment["savedServer"]> = {
  load: async () => (await SecureStore.getItemAsync(SERVER_KEY)) ?? undefined,
  save: (address) => SecureStore.setItemAsync(SERVER_KEY, address),
  clear: () => SecureStore.deleteItemAsync(SERVER_KEY),
};

// What the Android app gives the shared logic: React Native's network calls and the phone's own storage.
export const environment: AppEnvironment = {
  fetch: (url, init) => fetch(url, init),
  createSocket: (url) => new WebSocket(url),
  deviceName: BotsmanAlerts.deviceSummary(),
  tokenStore,
  savedServer,
  updater,
  backgroundAlerts,
};

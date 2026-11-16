import { useSyncExternalStore } from "react";

// The screen the address bar names, read from the part after `#`. Hash routes work the same in a browser tab
// and in the Windows app's window.
export type Route =
  | { name: "home" | "new-bot" | "providers" }
  | { name: "chat" | "bot" | "bot-settings" | "memory" | "notes"; botId: string }
  | { name: "note"; botId: string; note: string };

export function useRoute(): Route {
  return parseRoute(useSyncExternalStore(subscribe, currentHash, currentHash));
}

const at = (...parts: string[]) => `#/${parts.map(encodeURIComponent).join("/")}`;

export const chatHref = (botId: string) => at("chat", botId);
export const botInfoHref = (botId: string) => at("bot", botId);
export const botSettingsHref = (botId: string) => at("bot-settings", botId);
export const memoryHref = (botId: string) => at("memory", botId);
export const notesHref = (botId: string) => at("notes", botId);
export const noteHref = (botId: string, note: string) => at("note", botId, note);

const BOT_ROUTES = ["chat", "bot", "bot-settings", "memory", "notes"] as const;

function parseRoute(hash: string): Route {
  const [name, id, extra] = hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  const botRoute = BOT_ROUTES.find((route) => route === name);
  if (botRoute !== undefined && id) return { name: botRoute, botId: id };
  if (name === "note" && id && extra) return { name: "note", botId: id, note: extra };
  if (name === "new-bot" || name === "providers") return { name };
  return { name: "home" };
}

function currentHash(): string {
  return window.location.hash;
}

function subscribe(listener: () => void): () => void {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}

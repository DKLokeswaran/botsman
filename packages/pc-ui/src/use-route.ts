import { useSyncExternalStore } from "react";

// The screen the address bar names, read from the part after `#`. Hash routes work the same in a browser tab
// and in the Windows app's window.
export type Route = { name: "home" } | { name: "chat" | "bot" | "bot-settings"; botId: string };

export function useRoute(): Route {
  return parseRoute(useSyncExternalStore(subscribe, currentHash, currentHash));
}

export function chatHref(botId: string): string {
  return `#/chat/${encodeURIComponent(botId)}`;
}

export function botInfoHref(botId: string): string {
  return `#/bot/${encodeURIComponent(botId)}`;
}

export function botSettingsHref(botId: string): string {
  return `#/bot-settings/${encodeURIComponent(botId)}`;
}

const BOT_ROUTES = ["chat", "bot", "bot-settings"] as const;

function parseRoute(hash: string): Route {
  const [name, id] = hash.replace(/^#\/?/, "").split("/");
  const botRoute = BOT_ROUTES.find((route) => route === name);
  if (botRoute !== undefined && id) return { name: botRoute, botId: decodeURIComponent(id) };
  return { name: "home" };
}

function currentHash(): string {
  return window.location.hash;
}

function subscribe(listener: () => void): () => void {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}

import { parsePush, type PushRoute } from "@hermes-bots/gateway-client";

function routeString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function extraRoute(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  return routeString((value as Record<string, unknown>).route);
}

/**
 * Tauri 2.8 reports a toast click as ActionPerformed:
 * `{ actionId, inputValue, notification: { extra } }`.
 * A top-level `extra.route` is accepted as well.
 */
export function routeFromNotificationAction(event: unknown): PushRoute | null {
  if (!event || typeof event !== "object") return null;
  const record = event as Record<string, unknown>;
  const nested = record.notification;
  const fromNotification =
    nested && typeof nested === "object" ? extraRoute((nested as Record<string, unknown>).extra) : null;
  const raw = fromNotification ?? extraRoute(record.extra);
  if (!raw) return null;
  return parsePush(raw);
}

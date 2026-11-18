import { useAppName } from "@botsman/client-core/react";
import { alertText, type BotsmanClient } from "@botsman/client-core";
import { useEffect } from "react";
import type { PageNotifications } from "./platform.ts";
import { chatHref } from "./use-route.ts";

// Shows a notification for each alert while the page is open but not in front. A click brings up that bot's chat.
export function useAlertNotifications(client: BotsmanClient, notifications: PageNotifications | undefined, allowed: boolean): void {
  const appName = useAppName();
  useEffect(() => {
    if (notifications === undefined || !allowed) return;
    return client.followAlerts((alert) => {
      if (document.hasFocus()) return;
      const text = alertText(appName, alert, client.server.get().bots);
      notifications.show(text.title, text.body, () => {
        window.focus();
        window.location.hash = chatHref(alert.botId);
      });
    });
  }, [appName, client, notifications, allowed]);
}

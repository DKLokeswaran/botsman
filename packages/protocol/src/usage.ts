import { arr, int, obj, opt, type Static, str } from "@earendil-works/pi-schema";
import { Usage } from "./chat.ts";

// `days` counts back from today; `tzOffset` is the app's `Date.getTimezoneOffset()`, so days follow the owner's clock.
export const UsageQuery = obj({
  days: opt(int({ minimum: 1, maximum: 366 })),
  tzOffset: opt(int({ minimum: -840, maximum: 840 })),
});
export type UsageQuery = Static<typeof UsageQuery>;

// Spending over a period: the total, each day with replies (as YYYY-MM-DD), and each bot, highest cost first.
// It covers replies since the server began recording usage.
export const UsageReport = obj({
  since: int(),
  total: Usage,
  days: arr(obj({ day: str(), usage: Usage })),
  bots: arr(obj({ botId: str(), usage: Usage })),
});
export type UsageReport = Static<typeof UsageReport>;

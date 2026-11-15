import { int, lit, obj, oneOf, type Static, str, union } from "@earendil-works/pi-schema";

// Alert kinds from the PRD. The alert names the bot and the event; apps fetch any content from the server.
export const AlertKinds = [
  "approval",
  "question",
  "memory_proposal",
  "routine_result",
  "failure",
  "channel_mention",
  "routine_created",
  "skill_created",
] as const;

export const Alert = obj({
  id: str(),
  kind: oneOf(AlertKinds),
  botId: str(),
  refId: str(),
  createdAt: int(),
});
export type Alert = Static<typeof Alert>;

// Messages on the alerts stream, which background connections hold while the apps are closed.
export const AlertsClientMessage = union([
  obj({ type: lit("hello"), token: str(), epoch: str(), seq: int({ minimum: 0 }) }),
  obj({ type: lit("ping") }),
]);
export type AlertsClientMessage = Static<typeof AlertsClientMessage>;

export const AlertsServerMessage = union([
  obj({ type: lit("alert"), epoch: str(), seq: int(), alert: Alert }),
  obj({ type: lit("reset"), epoch: str(), seq: int() }),
  obj({ type: lit("pong") }),
  obj({ type: lit("error"), error: str(), message: str() }),
]);
export type AlertsServerMessage = Static<typeof AlertsServerMessage>;

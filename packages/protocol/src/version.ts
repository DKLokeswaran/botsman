import { int, obj, type Static } from "@earendil-works/pi-schema";

// The protocol number this code speaks. Raise it only for a change that breaks an existing client or server;
// a new optional field or a new route leaves it alone.
export const PROTOCOL_VERSION = 1;

// The oldest protocol number the server still accepts. It trails PROTOCOL_VERSION until both apps have moved on.
export const OLDEST_ACCEPTED_PROTOCOL = 1;

// The protocol numbers a server accepts, as it reports them.
export const ProtocolRange = obj({ oldest: int({ minimum: 1 }), current: int({ minimum: 1 }) });
export type ProtocolRange = Static<typeof ProtocolRange>;

export type ProtocolFit = "fits" | "update_app" | "update_server";

// Says whether an app speaking `appProtocol` can talk to a server, and which side to update when it can't.
export function protocolFit(appProtocol: number, server: ProtocolRange): ProtocolFit {
  if (appProtocol < server.oldest) return "update_app";
  if (appProtocol > server.current) return "update_server";
  return "fits";
}

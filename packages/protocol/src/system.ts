import { bool, nullable, obj, type Static, str } from "@earendil-works/pi-schema";
import { ProtocolRange } from "./version.ts";

export const Health = obj({
  ok: bool(),
  version: str(),
  protocol: ProtocolRange,
  sandbox: obj({ ok: bool(), reason: nullable(str()) }),
});
export type Health = Static<typeof Health>;

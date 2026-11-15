import { bool, lit, nullable, obj, oneOf, type Static, str } from "@earendil-works/pi-schema";

export const Health = obj({
  ok: bool(),
  version: str(),
  sandbox: obj({ ok: bool(), reason: nullable(str()) }),
});
export type Health = Static<typeof Health>;

// The web dashboard is not built yet; its path answers with this.
export const ComingSoon = obj({ status: lit("coming_soon"), feature: oneOf(["web-dashboard"]) });
export type ComingSoon = Static<typeof ComingSoon>;

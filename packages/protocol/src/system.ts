import { bool, nullable, obj, opt, type Static, str } from "@earendil-works/pi-schema";
import { ProtocolRange } from "./version.ts";

export const Health = obj({
  ok: bool(),
  // The server's release version, from server/package.json.
  version: str(),
  // The commit and branch the server was installed from, when the install script set them.
  commit: opt(str()),
  branch: opt(str()),
  // A preview server runs a branch under test, next to the real server.
  preview: opt(bool()),
  // The newest `server-v*` release on the server's git remote, once it has checked.
  latestVersion: opt(str()),
  protocol: ProtocolRange,
  sandbox: obj({ ok: bool(), reason: nullable(str()) }),
});
export type Health = Static<typeof Health>;

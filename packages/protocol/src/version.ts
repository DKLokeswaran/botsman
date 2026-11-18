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

// Compares two versions such as `0.2.0` or `0.2.0-preview.7+abc1234` in semver order: negative when the first is
// older. A pre-release comes before its release, and anything after `+` is ignored.
export function compareVersions(first: string, second: string): number {
  const [a, b] = [parseVersion(first), parseVersion(second)];
  for (let index = 0; index < 3; index += 1) {
    const difference = (a.core[index] ?? 0) - (b.core[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return comparePreReleases(a.preRelease, b.preRelease);
}

function parseVersion(version: string): { core: number[]; preRelease: string[] } {
  const withoutBuild = version.split("+")[0] ?? "";
  const dash = withoutBuild.indexOf("-");
  const core = dash === -1 ? withoutBuild : withoutBuild.slice(0, dash);
  return { core: core.split(".").map((part) => Number.parseInt(part, 10) || 0), preRelease: dash === -1 ? [] : withoutBuild.slice(dash + 1).split(".") };
}

// A version with no pre-release ranks above one with any. Otherwise the parts compare in turn, and a shorter
// pre-release that matches so far comes first.
function comparePreReleases(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return b.length - a.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = comparePreReleasePart(a[index], b[index]);
    if (difference !== 0) return difference;
  }
  return 0;
}

// Numbers compare as numbers and come before words, so `preview.10` is newer than `preview.9`.
function comparePreReleasePart(a: string | undefined, b: string | undefined): number {
  if (a === undefined || b === undefined) return a === b ? 0 : a === undefined ? -1 : 1;
  const [aIsNumber, bIsNumber] = [/^\d+$/.test(a), /^\d+$/.test(b)];
  if (aIsNumber && bIsNumber) return Number(a) - Number(b);
  if (aIsNumber !== bIsNumber) return aIsNumber ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

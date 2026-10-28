/**
 * Build label and the download-server latest.json document.
 * Keep this in step with contract/kotlin UpdateCheck.kt.
 */

export interface ReleaseFile {
  url: string;
  sha256: string;
  size: number;
  versionCode: number | null;
}

export interface LatestRelease {
  version: string;
  build: number;
  sha: string;
  windows: ReleaseFile;
  android: ReleaseFile;
}

export function formatAppVersion(name: string, build: string, sha: string): string {
  return `${name} (build ${build}, ${sha})`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function whole(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function file(value: unknown, requireCode: boolean): ReleaseFile | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const url = text(record.url);
  const sha256 = text(record.sha256);
  const size = whole(record.size);
  if (!url || !sha256 || size === null) {
    return null;
  }
  const versionCode = whole(record.versionCode);
  if (requireCode && versionCode === null) {
    return null;
  }
  return { url, sha256, size, versionCode };
}

export function parseLatest(raw: string): LatestRelease | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const record = asRecord(parsed);
  if (!record) {
    return null;
  }
  const version = text(record.version);
  const build = whole(record.build);
  const sha = text(record.sha);
  const windows = file(record.windows, false);
  const android = file(record.android, true);
  if (!version || build === null || !sha || !windows || !android) {
    return null;
  }
  return { version, build, sha, windows, android };
}

/** A published build number is newer than this install. "dev" is older than any positive build. */
export function updateAvailable(localBuild: string, remoteBuild: number): boolean {
  if (!Number.isInteger(remoteBuild) || remoteBuild < 0) {
    return false;
  }
  if (/^\d+$/.test(localBuild)) {
    return remoteBuild > Number(localBuild);
  }
  return remoteBuild > 0;
}

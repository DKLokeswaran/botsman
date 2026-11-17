// Release helpers for the app workflows.
//   node scripts/release.ts check <android|windows> <tag>
//   node scripts/release.ts manifest <android|windows> <tag> <file> [signature file]
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PROTOCOL_VERSION } from "../packages/protocol/src/version.ts";

type App = "android" | "windows";

const ROOT = path.join(import.meta.dirname, "..");
const VERSION_FILES: Record<App, string> = {
  android: "apps/android/app.json",
  windows: "apps/windows/src-tauri/tauri.conf.json",
};

// The version an app's own config file states.
function fileVersion(app: App): string {
  const config = JSON.parse(readFileSync(path.join(ROOT, VERSION_FILES[app]), "utf8")) as { version?: string; expo?: { version: string } };
  return app === "android" ? config.expo!.version : config.version!;
}

// The version a tag such as `android-v0.2.0` names.
function tagVersion(app: App, tag: string): string {
  const prefix = `${app}-v`;
  if (!tag.startsWith(prefix) || !/^\d+\.\d+\.\d+$/.test(tag.slice(prefix.length))) throw new Error(`"${tag}" is not a ${prefix}<major>.<minor>.<patch> tag`);
  return tag.slice(prefix.length);
}

// Android wants a whole number that grows with every release: 1.2.3 becomes 10203.
export function versionCode(version: string): number {
  const [major, minor, patch] = version.split(".").map(Number) as [number, number, number];
  return major * 10_000 + minor * 100 + patch;
}

// A release is refused when its tag and the app's config file disagree, so an installed app always knows its version.
function check(app: App, tag: string): void {
  const [wanted, found] = [tagVersion(app, tag), fileVersion(app)];
  if (wanted !== found) throw new Error(`Tag ${tag} says ${wanted}, but ${VERSION_FILES[app]} says ${found}. Set the version in the file, commit, and tag that commit.`);
  if (app === "android") checkVersionCode(wanted);
}

function checkVersionCode(version: string): void {
  const config = JSON.parse(readFileSync(path.join(ROOT, VERSION_FILES.android), "utf8")) as { expo: { android: { versionCode: number } } };
  const [wanted, found] = [versionCode(version), config.expo.android.versionCode];
  if (wanted !== found) throw new Error(`Version ${version} needs versionCode ${wanted} in ${VERSION_FILES.android}, which says ${found}.`);
}

function downloadUrl(tag: string, file: string): string {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) throw new Error("GITHUB_REPOSITORY is not set");
  return `https://github.com/${repository}/releases/download/${tag}/${path.basename(file)}`;
}

// What an installed app reads to learn about a newer build. The Windows file has the shape Tauri's updater expects.
function manifest(app: App, tag: string, file: string, signatureFile: string | undefined): unknown {
  const version = tagVersion(app, tag);
  const shared = { version, protocol: PROTOCOL_VERSION, pub_date: new Date().toISOString() };
  if (app === "android") {
    const sha256 = createHash("sha256").update(readFileSync(file)).digest("hex");
    return { ...shared, versionCode: versionCode(version), url: downloadUrl(tag, file), sha256 };
  }
  if (signatureFile === undefined) throw new Error("The Windows manifest needs the installer's .sig file");
  const signature = readFileSync(signatureFile, "utf8").trim();
  return { ...shared, platforms: { "windows-x86_64": { url: downloadUrl(tag, file), signature } } };
}

function main(): void {
  const [command, app, tag, file, signatureFile] = process.argv.slice(2);
  if (app !== "android" && app !== "windows") throw new Error("Name the app: android or windows");
  if (tag === undefined) throw new Error("Name the tag");
  if (command === "check") return check(app, tag);
  if (command === "manifest" && file !== undefined) return void console.log(JSON.stringify(manifest(app, tag, file, signatureFile), null, 2));
  throw new Error("Usage: release.ts check <app> <tag> | manifest <app> <tag> <file> [signature file]");
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

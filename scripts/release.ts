// Release helpers for the workflows.
//   node scripts/release.ts check <android|windows|server> <tag>
//   node scripts/release.ts preview <android|windows>
//   node scripts/release.ts manifest <android|windows> <release> <file> [signature file]
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PROTOCOL_VERSION } from "../packages/protocol/src/version.ts";

type Part = "android" | "windows" | "server";
type App = Exclude<Part, "server">;
type Config = Record<string, any>;

const ROOT = path.join(import.meta.dirname, "..");
const VERSION_FILES: Record<Part, string> = {
  android: "apps/android/app.json",
  windows: "apps/windows/src-tauri/tauri.conf.json",
  server: "server/package.json",
};
const PREVIEW_NAME = "Botsman Preview";
const PREVIEW_RELEASE = "preview";

function readConfig(part: Part): Config {
  return JSON.parse(readFileSync(path.join(ROOT, VERSION_FILES[part]), "utf8")) as Config;
}

function writeConfig(part: Part, config: Config): void {
  writeFileSync(path.join(ROOT, VERSION_FILES[part]), `${JSON.stringify(config, null, 2)}\n`);
}

// The version a part's own config file states.
function fileVersion(part: Part): string {
  const config = readConfig(part);
  return part === "android" ? config.expo.version : config.version;
}

// The version a tag such as `android-v0.2.0` names.
function tagVersion(part: Part, tag: string): string {
  const prefix = `${part}-v`;
  if (!tag.startsWith(prefix) || !/^\d+\.\d+\.\d+$/.test(tag.slice(prefix.length))) throw new Error(`"${tag}" is not a ${prefix}<major>.<minor>.<patch> tag`);
  return tag.slice(prefix.length);
}

// Android wants a whole number that grows with every release: 1.2.3 becomes 10203.
export function versionCode(version: string): number {
  const [major, minor, patch] = version.split(".").map(Number) as [number, number, number];
  return major * 10_000 + minor * 100 + patch;
}

// A release is refused when its tag and the part's config file disagree, so an installed copy always knows its version.
function check(part: Part, tag: string): void {
  const [wanted, found] = [tagVersion(part, tag), fileVersion(part)];
  if (wanted !== found) throw new Error(`Tag ${tag} says ${wanted}, but ${VERSION_FILES[part]} says ${found}. Set the version in the file, commit, and tag that commit.`);
  if (part === "android") checkVersionCode(wanted);
}

function checkVersionCode(version: string): void {
  const [wanted, found] = [versionCode(version), readConfig("android").expo.android.versionCode];
  if (wanted !== found) throw new Error(`Version ${version} needs versionCode ${wanted} in ${VERSION_FILES.android}, which says ${found}.`);
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// A preview's version, such as 0.0.42-preview+0.2.0.abc1234. The workflow's run number, which grows with every run,
// leads, so a newer preview is always the newer version, whatever the branch's own version. After the `+`, which semver
// ignores when it orders versions, come the config file's version and the commit, to name the code.
export function previewVersion(baseVersion: string, runNumber: string, commit: string): string {
  return `0.0.${runNumber}-preview+${baseVersion}.${commit.slice(0, 7)}`;
}

// Where a repo's preview apps find their newest build, so a fork's previews read the fork's own `preview` release.
function previewManifestUrl(app: App): string {
  return `https://github.com/${requiredEnv("GITHUB_REPOSITORY")}/releases/download/${PREVIEW_RELEASE}/${app}.json`;
}

// Turns this checkout's app config into the preview app's: its own app id and name, a preview version, and the
// preview update feed. The workflow runs this on the build machine only; nothing is committed.
function preview(app: App): string {
  const runNumber = requiredEnv("GITHUB_RUN_NUMBER");
  const version = previewVersion(fileVersion(app), runNumber, requiredEnv("GITHUB_SHA"));
  const config = readConfig(app);
  if (app === "android") previewAndroid(config, version, Number(runNumber));
  else previewWindows(config, version);
  writeConfig(app, config);
  return version;
}

// The preview app's version code is the run number, which only has to grow among preview builds.
function previewAndroid(config: Config, version: string, runNumber: number): void {
  const expo = config.expo;
  expo.name = PREVIEW_NAME;
  expo.version = version;
  expo.android.package = `${expo.android.package}.preview`;
  expo.android.versionCode = runNumber;
  expo.extra.updateManifestUrl = previewManifestUrl("android");
}

function previewWindows(config: Config, version: string): void {
  config.productName = PREVIEW_NAME;
  config.version = version;
  config.identifier = `${config.identifier}.preview`;
  config.app.windows[0].title = PREVIEW_NAME;
  config.plugins.updater.endpoints = [previewManifestUrl("windows")];
}

function downloadUrl(release: string, file: string): string {
  return `https://github.com/${requiredEnv("GITHUB_REPOSITORY")}/releases/download/${release}/${path.basename(file)}`;
}

// What an installed app reads to learn about a newer build, with the version in the app's config file. The Windows
// file has the shape Tauri's updater expects.
function manifest(app: App, release: string, file: string, signatureFile: string | undefined): unknown {
  const shared = { version: fileVersion(app), protocol: PROTOCOL_VERSION, pub_date: new Date().toISOString() };
  if (app === "android") {
    const sha256 = createHash("sha256").update(readFileSync(file)).digest("hex");
    return { ...shared, versionCode: readConfig("android").expo.android.versionCode, url: downloadUrl(release, file), sha256 };
  }
  if (signatureFile === undefined) throw new Error("The Windows manifest needs the installer's .sig file");
  const signature = readFileSync(signatureFile, "utf8").trim();
  return { ...shared, platforms: { "windows-x86_64": { url: downloadUrl(release, file), signature } } };
}

const USAGE = "Usage: release.ts check <android|windows|server> <tag> | preview <android|windows> | manifest <android|windows> <release> <file> [signature file]";

function parsePart(value: string | undefined): Part {
  if (value === "android" || value === "windows" || value === "server") return value;
  throw new Error("Name the part: android, windows, or server");
}

// Only the apps have preview builds and update manifests.
function asApp(part: Part): App {
  if (part === "server") throw new Error(USAGE);
  return part;
}

function requiredArgument(value: string | undefined): string {
  if (value === undefined) throw new Error(USAGE);
  return value;
}

function main(): void {
  const [command, partName, name, file, signatureFile] = process.argv.slice(2);
  const part = parsePart(partName);
  if (command === "check") return check(part, requiredArgument(name));
  if (command === "preview") return void console.log(preview(asApp(part)));
  if (command === "manifest") return void console.log(JSON.stringify(manifest(asApp(part), requiredArgument(name), requiredArgument(file), signatureFile), null, 2));
  throw new Error(USAGE);
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

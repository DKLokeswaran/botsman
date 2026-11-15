import { existsSync, realpathSync } from "node:fs";
import path from "node:path";

export type FolderRules = {
  readonly homeDir: string;
  readonly dataDir: string;
  readonly backupDir: string;
  // The default folder of the bot being checked, the one path inside the data folder a bot may have.
  readonly defaultFolder: string;
  readonly otherBotFolders: readonly string[];
};

export type FolderCheck = { readonly allowed: true; readonly path: string } | { readonly allowed: false; readonly path: string; readonly reason: string };

// Decides whether a bot may have read-write access to a folder, following the refused paths in docs/decisions/overview.md.
export function checkFolder(requested: string, rules: FolderRules): FolderCheck {
  if (!path.isAbsolute(requested)) return { allowed: false, path: requested, reason: "The folder must be an absolute path" };
  const folder = resolveReal(requested);
  const reason = refusalReason(folder, resolveRules(rules));
  return reason === undefined ? { allowed: true, path: folder } : { allowed: false, path: folder, reason };
}

function refusalReason(folder: string, rules: FolderRules): string | undefined {
  const sensitive = [".ssh", ".claude", ".agents"].map((name) => path.join(rules.homeDir, name));
  if (folder === path.parse(folder).root) return "The root folder would expose the whole server";
  if (isInside(rules.homeDir, folder)) return "The folder would expose the owner's home folder";
  if (sensitive.some((target) => isInside(folder, target))) return "The folder is inside a sensitive folder";
  if (folder !== rules.defaultFolder && overlaps(folder, rules.dataDir)) return "The folder overlaps Botsman's own data";
  if (overlaps(folder, rules.backupDir)) return "The folder overlaps Botsman's backups";
  if (rules.otherBotFolders.some((other) => overlaps(folder, other))) return "The folder overlaps another bot's folder";
  return undefined;
}

// True when `inner` is `outer` or sits inside it.
export function isInside(inner: string, outer: string): boolean {
  const relative = path.relative(outer, inner);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function overlaps(a: string, b: string): boolean {
  return isInside(a, b) || isInside(b, a);
}

function resolveRules(rules: FolderRules): FolderRules {
  return {
    homeDir: resolveReal(rules.homeDir),
    dataDir: resolveReal(rules.dataDir),
    backupDir: resolveReal(rules.backupDir),
    defaultFolder: resolveReal(rules.defaultFolder),
    otherBotFolders: rules.otherBotFolders.map(resolveReal),
  };
}

// Resolves symbolic links in the part of the path that exists, so a link can't hide where a folder really is.
export function resolveReal(target: string): string {
  const absolute = path.resolve(target);
  let existing = absolute;
  while (!existsSync(existing)) existing = path.dirname(existing);
  return path.join(realpathSync(existing), path.relative(existing, absolute));
}

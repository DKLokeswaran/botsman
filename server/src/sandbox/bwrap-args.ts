import { existsSync, lstatSync, readlinkSync, realpathSync } from "node:fs";
import path from "node:path";

export type SandboxSpec = {
  // The bot's folder: the only writable path, and HOME inside the sandbox.
  readonly folder: string;
  readonly network: boolean;
  // The pi-env daemon program, mounted read-only at SANDBOX_DAEMON so the sandbox can run it without seeing where
  // Botsman is installed.
  readonly daemon: string;
  // The owner's ~/.agents, mounted read-only at its real path when it exists.
  readonly agentsDir: string;
  // Botsman's shared skill pool, mounted read-only.
  readonly skillsDir: string;
};

export const SANDBOX_DAEMON = "/run/botsman/pi-env";

const TOP_LEVEL_LINKS = ["bin", "sbin", "lib", "lib32", "lib64", "libx32"];

// The bwrap arguments for one bot's sandbox: an allow list where only the listed paths exist.
// Mount order matters: private /proc, /dev, and /tmp come first, so later binds under /tmp stay visible.
export function sandboxArgs(spec: SandboxSpec): string[] {
  return [
    "--die-with-parent",
    "--new-session",
    "--unshare-all",
    "--unshare-user",
    "--disable-userns",
    "--cap-drop",
    "ALL",
    ...(spec.network ? ["--share-net"] : []),
    "--proc",
    "/proc",
    "--dev",
    "/dev",
    "--tmpfs",
    "/tmp",
    "--ro-bind",
    "/usr",
    "/usr",
    ...topLevelArgs(),
    "--ro-bind",
    "/etc",
    "/etc",
    ...resolverArgs(),
    "--ro-bind",
    spec.daemon,
    SANDBOX_DAEMON,
    ...readOnlyIfPresent(spec.skillsDir),
    ...readOnlyIfPresent(spec.agentsDir),
    "--bind",
    spec.folder,
    spec.folder,
    "--chdir",
    spec.folder,
    "--clearenv",
    "--setenv",
    "PATH",
    "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    "--setenv",
    "HOME",
    spec.folder,
    "--setenv",
    "TMPDIR",
    "/tmp",
  ];
}

// /bin, /lib and friends: links into /usr on merged-/usr systems, read-only folders elsewhere.
function topLevelArgs(): string[] {
  const args: string[] = [];
  for (const name of TOP_LEVEL_LINKS) {
    const target = `/${name}`;
    if (!existsSync(target)) continue;
    const stat = lstatSync(target);
    if (stat.isSymbolicLink()) args.push("--symlink", readlinkSync(target), target);
    else if (stat.isDirectory()) args.push("--ro-bind", target, target);
  }
  return args;
}

// The DNS resolver folder, when /etc/resolv.conf points outside /etc (systemd-resolved points into /run).
function resolverArgs(): string[] {
  const resolv = "/etc/resolv.conf";
  if (!existsSync(resolv)) return [];
  const folder = path.dirname(realpathSync(resolv));
  return folder.startsWith("/etc") ? [] : ["--ro-bind", folder, folder];
}

function readOnlyIfPresent(folder: string): string[] {
  return existsSync(folder) ? ["--ro-bind", folder, folder] : [];
}

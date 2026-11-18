import { compareVersions, type Health } from "@botsman/protocol";

// What updates a server to its newest release, run in the server's Botsman folder.
export const SERVER_UPDATE_COMMAND = "deploy/install.sh";

// The connected server's version as settings shows it, such as "Server 0.2.0" or, for a preview server,
// "Server 0.2.0 · Preview of fix-login at abc1234".
export function serverVersionLine(health: Health): string {
  const line = `Server ${health.version}`;
  if (health.preview !== true) return line;
  const code = [health.branch, health.commit].filter((part) => part !== undefined).join(" at ");
  return code === "" ? `${line} · Preview` : `${line} · Preview of ${code}`;
}

// The newer server release the owner can update to, if there is one. A preview server runs a branch on purpose, so
// it is never told to update.
export function serverUpdate(health: Health): string | undefined {
  if (health.preview === true || health.latestVersion === undefined) return undefined;
  return compareVersions(health.latestVersion, health.version) > 0 ? health.latestVersion : undefined;
}

// What the update notice says before the command. The apps can't update a server themselves, so it says where to run
// it. `version` is undefined when the server doesn't know its newest release.
export function serverUpdateText(version: string | undefined): string {
  const lead = version === undefined ? "" : `Server ${version} is available. `;
  return `${lead}To update, run this in the Botsman folder on the server:`;
}

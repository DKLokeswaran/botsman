import { compareVersions, type Health } from "@botsman/protocol";

// What the apps tell the owner to run on the server. The apps can't update a server themselves.
export type ServerUpdateSteps = { text: string; command: string };

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

// How to update the connected server: a preview server moves to the newest commit of its branch, and any other
// server to its newest release. With no health yet, it gives the release command.
export function serverUpdateSteps(health: Health | undefined): ServerUpdateSteps {
  if (health?.preview === true) {
    const branch = health.branch === undefined ? "<branch>" : shellWord(health.branch);
    return { text: "To update this preview server, run this in the real server's Botsman folder:", command: `deploy/install.sh --preview ${branch}` };
  }
  const latest = health === undefined ? undefined : serverUpdate(health);
  const lead = latest === undefined ? "" : `Server ${latest} is available. `;
  return { text: `${lead}To update, run this in the Botsman folder on the server:`, command: "deploy/install.sh" };
}

// A branch name as one shell word. The owner pastes the command into a shell, and a branch name can hold spaces, `;`,
// `$`, or quotes, so anything beyond plain name characters is single-quoted.
function shellWord(text: string): string {
  return /^[\w./-]+$/.test(text) ? text : `'${text.replaceAll("'", `'\\''`)}'`;
}

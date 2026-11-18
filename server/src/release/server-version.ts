import { readFileSync } from "node:fs";
import path from "node:path";

// The server's release version, from server/package.json. `scripts/release.ts check server` keeps it in step with
// the `server-v*` tag.
export const SERVER_VERSION = (JSON.parse(readFileSync(path.join(import.meta.dirname, "..", "..", "package.json"), "utf8")) as { version: string }).version;

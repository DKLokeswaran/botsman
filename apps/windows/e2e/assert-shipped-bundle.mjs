import { spawnSync } from "node:child_process";
import { readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const windowsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(windowsRoot, "e2e", ".shipped-dist");
const marker = "hermes-e2e-shim";
const viteBin = path.join(windowsRoot, "node_modules", "vite", "bin", "vite.js");

await rm(outDir, { recursive: true, force: true });
const build = spawnSync(process.execPath, [viteBin, "build", "--outDir", outDir, "--emptyOutDir"], {
  cwd: windowsRoot,
  stdio: "inherit",
});
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

let jsFiles = 0;
let leaked = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full);
      continue;
    }
    if (!/\.(js|css|html)$/.test(entry.name)) {
      continue;
    }
    if (entry.name.endsWith(".js")) {
      jsFiles += 1;
    }
    const text = await readFile(full, "utf8");
    if (text.includes(marker)) {
      leaked.push(path.relative(windowsRoot, full));
    }
  }
}

await walk(outDir);
if (jsFiles === 0) {
  console.error("default vite build produced no JavaScript");
  process.exit(1);
}
if (leaked.length > 0) {
  console.error(`shipped bundle contains the e2e shim marker in ${leaked.join(", ")}`);
  process.exit(1);
}
console.log(`shipped bundle (${jsFiles} js files) does not contain the e2e shim`);

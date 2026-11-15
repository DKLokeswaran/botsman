import { writeFileSync } from "node:fs";
import { themeCss } from "../src/index.ts";

// Writes theme.css, which is committed so the apps need no build step to read it.
writeFileSync(new URL("../theme.css", import.meta.url), themeCss());

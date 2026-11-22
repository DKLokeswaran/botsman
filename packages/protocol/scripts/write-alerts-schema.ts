import { writeFileSync } from "node:fs";
import { alertsJsonSchema } from "../src/alerts-schema.ts";

// Writes schema/alerts.schema.json, which the Windows and Android alert connections generate their types from.
const target = new URL("../schema/alerts.schema.json", import.meta.url);
writeFileSync(target, `${JSON.stringify(alertsJsonSchema(), null, 2)}\n`);
console.log(`wrote ${target.pathname}`);

import { readFileSync, writeFileSync } from "node:fs";
import { alertsJsonSchema } from "./alerts-schema.ts";
import { ALERTS_TYPE_FILES, kotlinAlertsTypes, rustAlertsTypes } from "./alerts-types.ts";

// Writes schema/alerts.schema.json, then the Windows (Rust) and Android (Kotlin) message types generated from it.
const schemaFile = new URL("../schema/alerts.schema.json", import.meta.url);
writeFileSync(schemaFile, `${JSON.stringify(alertsJsonSchema(), null, 2)}\n`);
const schema = JSON.parse(readFileSync(schemaFile, "utf8"));
writeFileSync(ALERTS_TYPE_FILES.rust, rustAlertsTypes(schema));
writeFileSync(ALERTS_TYPE_FILES.kotlin, kotlinAlertsTypes(schema));
for (const file of [schemaFile, ALERTS_TYPE_FILES.rust, ALERTS_TYPE_FILES.kotlin]) console.log(`wrote ${file.pathname}`);

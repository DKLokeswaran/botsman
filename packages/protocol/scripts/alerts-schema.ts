import { Alert, AlertsClientMessage, AlertsServerMessage } from "../src/alerts.ts";

// The alerts stream as one JSON Schema document, the source for the Rust and Kotlin message types.
export function alertsJsonSchema(): object {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://botsman.local/schema/alerts.schema.json",
    title: "Botsman alerts stream",
    $defs: { Alert, AlertsClientMessage, AlertsServerMessage },
  };
}

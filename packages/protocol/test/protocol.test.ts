import { readFileSync } from "node:fs";
import { compile } from "@earendil-works/pi-schema";
import { describe, expect, it } from "vitest";
import * as protocol from "../src/index.ts";

describe("protocol schemas", () => {
  it("compile as JSON Schema", () => {
    const schemas = Object.entries(protocol).filter(([, value]) => isSchema(value));
    expect(schemas.length).toBeGreaterThan(20);
    for (const [, schema] of schemas) expect(() => compile(schema as object)).not.toThrow();
  });

  it("accept a valid message and reject an unknown field", () => {
    const message = compile(protocol.SendMessageRequest);
    expect(message.check({ text: "hi", mode: "steer" })).toBe(true);
    expect(message.check({ text: "hi", extra: 1 })).toBe(false);
  });

  it("keep the committed alerts schema in sync", () => {
    const committed = JSON.parse(readFileSync(new URL("../schema/alerts.schema.json", import.meta.url), "utf8"));
    expect(committed).toEqual(JSON.parse(JSON.stringify(protocol.alertsJsonSchema())));
  });
});

function isSchema(value: unknown): boolean {
  return typeof value === "object" && value !== null && ("type" in value || "anyOf" in value || "enum" in value);
}

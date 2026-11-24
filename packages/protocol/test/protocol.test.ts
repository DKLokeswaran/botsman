import { readFileSync } from "node:fs";
import { compile } from "@earendil-works/pi-schema";
import { describe, expect, it } from "vitest";
import { alertsJsonSchema } from "../scripts/alerts-schema.ts";
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
    expect(committed).toEqual(JSON.parse(JSON.stringify(alertsJsonSchema())));
  });
});

describe("versions", () => {
  it("compare by their numbers, not as text", () => {
    expect(protocol.compareVersions("0.10.0", "0.9.9")).toBeGreaterThan(0);
    expect(protocol.compareVersions("1.0.0", "1.0.0")).toBe(0);
  });

  it("put a pre-release before its release and order previews by their number", () => {
    expect(protocol.compareVersions("0.2.0-preview.3", "0.2.0")).toBeLessThan(0);
    expect(protocol.compareVersions("0.2.0-preview.10", "0.2.0-preview.9")).toBeGreaterThan(0);
    expect(protocol.compareVersions("0.2.0-preview", "0.2.0-preview.1")).toBeLessThan(0);
    expect(protocol.compareVersions("0.2.0-1", "0.2.0-preview")).toBeLessThan(0);
  });

  it("ignore the build after +", () => {
    expect(protocol.compareVersions("0.2.0-preview.4+abc1234", "0.2.0-preview.4+def5678")).toBe(0);
  });
});

describe("protocol version", () => {
  it("fits inside the range a server accepts", () => {
    expect(protocol.protocolFit(2, { oldest: 1, current: 3 })).toBe("fits");
    expect(protocol.protocolFit(1, { oldest: 1, current: 1 })).toBe("fits");
  });

  it("names the side to update when it does not fit", () => {
    expect(protocol.protocolFit(1, { oldest: 2, current: 3 })).toBe("update_app");
    expect(protocol.protocolFit(4, { oldest: 2, current: 3 })).toBe("update_server");
  });

  it("keeps the oldest accepted number at or below the current one", () => {
    expect(protocol.OLDEST_ACCEPTED_PROTOCOL).toBeLessThanOrEqual(protocol.PROTOCOL_VERSION);
  });
});

function isSchema(value: unknown): boolean {
  return typeof value === "object" && value !== null && ("type" in value || "anyOf" in value || "enum" in value);
}

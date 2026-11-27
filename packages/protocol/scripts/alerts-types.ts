import { isDeepStrictEqual } from "node:util";

// Writes the Rust and Kotlin message types for the alerts stream from its JSON Schema. It reads the subset the
// schema uses: objects of strings, integers, booleans, string enums and other definitions, and unions of objects
// told apart by a "type" constant.

type SchemaNode = { type?: string; enum?: string[]; const?: string; properties?: Record<string, SchemaNode>; required?: string[]; anyOf?: SchemaNode[] };
type AlertsSchema = { $defs: Record<string, SchemaNode> };

type FieldType = { kind: "string" | "integer" | "boolean" } | { kind: "enum" | "ref"; name: string };
type Field = { name: string; type: FieldType; optional: boolean };
type Variant = { tag: string; name: string; fields: Field[] };
type Model = {
  defs: Record<string, SchemaNode>;
  enums: { name: string; values: string[] }[];
  structs: { name: string; fields: Field[] }[];
  unions: { name: string; variants: Variant[] }[];
};

export const ALERTS_TYPE_FILES = {
  rust: new URL("../../../apps/windows/src-tauri/src/alerts_stream.rs", import.meta.url),
  kotlin: new URL("../../../apps/android/modules/botsman-alerts/android/src/main/java/dev/botsman/alerts/AlertsStream.kt", import.meta.url),
};

const HEADER = "Generated from packages/protocol/schema/alerts.schema.json by `pnpm --filter @botsman/protocol alerts-schema`. Do not edit.";
const KOTLIN_PACKAGE = "dev.botsman.alerts";

// ---- Reading the schema ----

function readModel(schema: AlertsSchema): Model {
  const model: Model = { defs: schema.$defs, enums: [], structs: [], unions: [] };
  for (const [name, node] of Object.entries(schema.$defs)) {
    if (node.anyOf) model.unions.push({ name, variants: node.anyOf.map((member) => readVariant(model, name, member)) });
    else model.structs.push({ name, fields: readFields(model, name, node.properties ?? {}, node.required) });
  }
  return model;
}

function readVariant(model: Model, union: string, node: SchemaNode): Variant {
  const { type, ...properties } = node.properties ?? {};
  const tag = type?.const;
  if (typeof tag !== "string") throw new Error(`${union}: every member needs a "type" constant`);
  return { tag, name: pascal(tag), fields: readFields(model, union + pascal(tag), properties, node.required) };
}

function readFields(model: Model, owner: string, properties: Record<string, SchemaNode>, required: string[] = []): Field[] {
  return Object.entries(properties).map(([name, node]) => ({ name, type: readType(model, owner + pascal(name), node), optional: !required.includes(name) }));
}

// An enum is named after its owner and field, and an inline object must repeat one of the definitions.
function readType(model: Model, name: string, node: SchemaNode): FieldType {
  if (node.enum) return { kind: "enum", name: addEnum(model, name, node.enum) };
  if (node.type === "object") return { kind: "ref", name: definitionOf(model, node) };
  if (node.type === "string" || node.type === "integer" || node.type === "boolean") return { kind: node.type };
  throw new Error(`${name}: unsupported schema ${JSON.stringify(node)}`);
}

function addEnum(model: Model, name: string, values: string[]): string {
  const same = model.enums.find((existing) => isDeepStrictEqual(existing.values, values));
  if (same) return same.name;
  model.enums.push({ name, values });
  return name;
}

function definitionOf(model: Model, node: SchemaNode): string {
  const match = Object.entries(model.defs).find(([, definition]) => isDeepStrictEqual(definition, node));
  if (!match) throw new Error(`an inline object matches no definition: ${JSON.stringify(node)}`);
  return match[0];
}

function pascal(name: string): string {
  return name.replace(/(^|_)([a-z])/g, (_, __, letter: string) => letter.toUpperCase()).replace(/^[a-z]/, (letter) => letter.toUpperCase());
}

function snake(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

// ---- Rust, with serde ----

export function rustAlertsTypes(schema: AlertsSchema): string {
  const model = readModel(schema);
  const parts = [`// ${HEADER}`, "#![allow(dead_code)]", "use serde::{Deserialize, Serialize};"];
  parts.push(...model.enums.map(rustEnum), ...model.structs.map(rustStruct), ...model.unions.map(rustUnion));
  return `${parts.join("\n\n")}\n`;
}

function rustEnum({ name, values }: { name: string; values: string[] }): string {
  return [
    "// Unknown stands for a value added after this build.",
    "#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]",
    `pub enum ${name} {`,
    ...values.map((value) => `    #[serde(rename = "${value}")]\n    ${pascal(value)},`),
    "    #[serde(other)]\n    Unknown,\n}\n",
    `impl ${name} {\n    pub fn as_str(&self) -> &'static str {\n        match self {`,
    ...values.map((value) => `            Self::${pascal(value)} => "${value}",`),
    '            Self::Unknown => "",\n        }\n    }\n}',
  ].join("\n");
}

function rustStruct({ name, fields }: { name: string; fields: Field[] }): string {
  return ["#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]", `pub struct ${name} {`, ...fields.map((field) => rustField(field, "    pub ")), "}"].join("\n");
}

function rustUnion({ name, variants }: { name: string; variants: Variant[] }): string {
  return [
    "// Unknown stands for a message type added after this build.",
    "#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]",
    '#[serde(tag = "type")]',
    `pub enum ${name} {`,
    ...variants.map(rustVariant),
    "    #[serde(other)]\n    Unknown,\n}",
  ].join("\n");
}

function rustVariant({ tag, name, fields }: Variant): string {
  const rename = `    #[serde(rename = "${tag}")]`;
  if (fields.length === 0) return `${rename}\n    ${name},`;
  return [rename, `    ${name} {`, ...fields.map((field) => rustField(field, "        ")), "    },"].join("\n");
}

function rustField(field: Field, prefix: string): string {
  const indent = prefix.replace("pub ", "");
  const lines: string[] = [];
  if (snake(field.name) !== field.name) lines.push(`${indent}#[serde(rename = "${field.name}")]`);
  if (field.optional) lines.push(`${indent}#[serde(default, skip_serializing_if = "Option::is_none")]`);
  const type = field.optional ? `Option<${rustType(field.type)}>` : rustType(field.type);
  lines.push(`${prefix}${snake(field.name)}: ${type},`);
  return lines.join("\n");
}

function rustType(type: FieldType): string {
  if ("name" in type) return type.name;
  return { string: "String", integer: "i64", boolean: "bool" }[type.kind];
}

// ---- Kotlin, with org.json ----

export function kotlinAlertsTypes(schema: AlertsSchema): string {
  const model = readModel(schema);
  const parts = [`// ${HEADER}`, `package ${KOTLIN_PACKAGE}`, "import org.json.JSONObject"];
  parts.push(...model.enums.map(kotlinEnum), ...model.structs.map(kotlinStruct), ...model.unions.map(kotlinUnion));
  return `${parts.join("\n\n")}\n`;
}

function kotlinEnum({ name, values }: { name: string; values: string[] }): string {
  return [
    "// UNKNOWN stands for a value added after this build.",
    `enum class ${name}(val value: String) {`,
    ...values.map((value) => `  ${snake(value).toUpperCase()}("${value}"),`),
    '  UNKNOWN("");\n',
    `  companion object {\n    fun from(value: String): ${name} = entries.firstOrNull { it.value == value } ?: UNKNOWN\n  }\n}`,
  ].join("\n");
}

function kotlinStruct({ name, fields }: { name: string; fields: Field[] }): string {
  return [
    `data class ${name}(`,
    ...fields.map((field) => `  val ${field.name}: ${kotlinType(field)},`),
    ") {",
    kotlinToJson(fields, "  fun", undefined),
    "",
    `  companion object {\n    fun fromJson(json: JSONObject): ${name} = ${name}(`,
    ...fields.map((field) => `      ${kotlinRead(field)},`),
    "    )\n  }\n}",
  ].join("\n");
}

// A sealed interface with one class per message type. Definitions are named in full, because a message type may
// share a definition's name.
function kotlinUnion({ name, variants }: { name: string; variants: Variant[] }): string {
  return [
    `sealed interface ${name} {`,
    "  fun toJson(): JSONObject\n",
    ...variants.map((variant) => kotlinVariant(name, variant)),
    "  // A message type added after this build.",
    `  data object Unknown : ${name} {\n    override fun toJson(): JSONObject = JSONObject()\n  }\n`,
    `  companion object {\n    fun fromJson(json: JSONObject): ${name} = when (json.optString("type")) {`,
    ...variants.map((variant) => kotlinReadVariant(name, variant)),
    "      else -> Unknown\n    }\n  }\n}",
  ].join("\n");
}

function kotlinVariant(union: string, { tag, name, fields }: Variant): string {
  if (fields.length === 0) return `  data object ${name} : ${union} {\n    override fun toJson(): JSONObject = JSONObject().put("type", "${tag}")\n  }\n`;
  return [
    `  data class ${name}(`,
    ...fields.map((field) => `    val ${field.name}: ${kotlinType(field, true)},`),
    `  ) : ${union} {`,
    kotlinToJson(fields, "    override fun", tag),
    "  }\n",
  ].join("\n");
}

function kotlinReadVariant(union: string, { tag, name, fields }: Variant): string {
  if (fields.length === 0) return `      "${tag}" -> ${name}`;
  return [`      "${tag}" -> ${union}.${name}(`, ...fields.map((field) => `        ${kotlinRead(field, true)},`), "      )"].join("\n");
}

function kotlinToJson(fields: Field[], declaration: string, tag: string | undefined): string {
  const indent = declaration.replace(/\S.*/, "");
  const puts = fields.map((field) => `${indent}  .put("${field.name}", ${kotlinWrite(field)})`);
  if (tag !== undefined) puts.unshift(`${indent}  .put("type", "${tag}")`);
  return [`${declaration} toJson(): JSONObject = JSONObject()`, ...puts].join("\n");
}

function kotlinType(field: Field, qualify = false): string {
  const type = "name" in field.type ? qualified(field.type.name, qualify) : { string: "String", integer: "Long", boolean: "Boolean" }[field.type.kind];
  return field.optional ? `${type}?` : type;
}

function kotlinRead(field: Field, qualify = false): string {
  const key = `"${field.name}"`;
  const reads = {
    string: `json.getString(${key})`,
    integer: `json.getLong(${key})`,
    boolean: `json.getBoolean(${key})`,
    enum: `${qualified(typeName(field), qualify)}.from(json.getString(${key}))`,
    ref: `${qualified(typeName(field), qualify)}.fromJson(json.getJSONObject(${key}))`,
  };
  const read = reads[field.type.kind];
  return field.optional ? `if (json.has(${key})) ${read} else null` : read;
}

function kotlinWrite(field: Field): string {
  const access = field.optional ? "?." : ".";
  if (field.type.kind === "enum") return `${field.name}${access}value`;
  if (field.type.kind === "ref") return `${field.name}${access}toJson()`;
  return field.name;
}

function typeName(field: Field): string {
  return "name" in field.type ? field.type.name : "";
}

function qualified(name: string, qualify: boolean): string {
  return qualify ? `${KOTLIN_PACKAGE}.${name}` : name;
}

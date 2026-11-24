import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { cssVariable, fontFaces, palettes, themeCss } from "../src/index.ts";

test("theme.css matches the tokens", () => {
  expect(readFileSync(new URL("../theme.css", import.meta.url), "utf8")).toBe(themeCss());
});

test("the fonts folder holds exactly the listed font files", () => {
  const files = readdirSync(new URL("../fonts", import.meta.url)).filter((file) => file.endsWith(".ttf"));
  expect(files.sort()).toEqual(Object.values(fontFaces).map((face) => `${face.file}.ttf`).sort());
});

test("both palettes define the same keys", () => {
  expect(Object.keys(palettes.light)).toEqual(Object.keys(palettes.dark));
});

test("palette keys become kebab-case CSS variables", () => {
  expect(cssVariable("cardForeground")).toBe("--card-foreground");
  expect(cssVariable("ring")).toBe("--ring");
});

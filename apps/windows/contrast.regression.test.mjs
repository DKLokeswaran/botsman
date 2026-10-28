import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function channel(value) {
  const scaled = value / 255;
  return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const raw = hex.slice(1);
  const red = parseInt(raw.slice(0, 2), 16);
  const green = parseInt(raw.slice(2, 4), 16);
  const blue = parseInt(raw.slice(4, 6), 16);
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

function contrast(foreground, background) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function copyButtonRatio(theme) {
  const data = JSON.parse(readFileSync(join(root, "tokens/zoetrik.json"), "utf8"));
  const styles = readFileSync(join(root, "apps/windows/src/styles.css"), "utf8");
  assert.match(styles, /\.fence-bar button[^}]*color:\s*var\(--accent\)/);
  assert.match(styles, /\.fence \{[^}]*background:\s*var\(--bg-3\)/);
  return contrast(data[theme].accent, data[theme].bg3);
}

test("test_bug_light_mode_copy_button_contrast", () => {
  const ratio = copyButtonRatio("light");
  assert.ok(ratio >= 4.5, `light Copy contrast is ${ratio.toFixed(2)}:1`);
});

test("dark_mode_copy_button_contrast", () => {
  const ratio = copyButtonRatio("dark");
  assert.ok(ratio >= 4.5, `dark Copy contrast is ${ratio.toFixed(2)}:1`);
});

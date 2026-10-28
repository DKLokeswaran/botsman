#!/usr/bin/env python3
"""Write Zoetrik CSS and a Kotlin colour table from tokens/zoetrik.json."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "zoetrik.json"
CSS = ROOT / "zoetrik.css"
KOTLIN = ROOT.parent / "apps/android/app/src/main/kotlin/com/hermesbots/phase0/ZoetrikColors.kt"

MAP = {
    "bg": "bg",
    "bg2": "bg-2",
    "bg3": "bg-3",
    "btn": "btn",
    "btnFg": "btn-fg",
    "fg": "fg",
    "fgMuted": "fg-muted",
    "accent": "accent",
    "accentFg": "accent-fg",
    "border": "line",
    "green": "green",
    "cyan": "cyan",
    "blue": "blue",
    "mint": "mint",
    "magenta": "magenta",
    "paper": "paper",
    "error": "error",
}


def css_block(selector: str, colors: dict) -> str:
    lines = [f"{selector} {{"]
    for key, name in MAP.items():
        lines.append(f"  --{name}: {colors[key]};")
    lines.append("}")
    return "\n".join(lines)


def render() -> str:
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    fonts = data["fonts"]
    return "\n".join(
        [
            "/* Generated from tokens/zoetrik.json. Do not edit by hand. */",
            css_block(":root, :root[data-theme='light']", data["light"]),
            css_block(":root[data-theme='dark']", data["dark"]),
            "@media (prefers-color-scheme: dark) {",
            css_block("  :root:not([data-theme='light'])", data["dark"]).replace("\n", "\n"),
            "}",
            ":root {",
            f'  --font-display: "{fonts["display"]}", sans-serif;',
            f'  --font-label: "{fonts["label"]}", sans-serif;',
            f'  --font-body: "{fonts["body"]}", system-ui, sans-serif;',
            f'  --font-mono: "{fonts["mono"]}", ui-monospace, monospace;',
            "  --radius: 4px;",
            "  --radius-sm: 3px;",
            "  --radius-lg: 8px;",
            "  --background: var(--bg);",
            "  --foreground: var(--fg);",
            "  --card: var(--bg-2);",
            "  --card-foreground: var(--fg);",
            "  --primary: var(--accent);",
            "  --primary-foreground: var(--accent-fg);",
            "  --muted-foreground: var(--fg-muted);",
            "  --border: var(--line);",
            "  --input: var(--line);",
            "  --ring: var(--accent);",
            "}",
            "",
        ]
    )


def kotlin_color(hex_color: str) -> str:
    raw = hex_color.removeprefix("#").upper()
    return f"Color(0xFF{raw})"


def kotlin_scheme(name: str, colors: dict) -> str:
    mapping = {
        "primary": "accent",
        "onPrimary": "accentFg",
        "background": "bg",
        "onBackground": "fg",
        "surface": "bg2",
        "onSurface": "fg",
        "surfaceVariant": "bg3",
        "onSurfaceVariant": "fgMuted",
        "outline": "border",
        "error": "error",
        "tertiary": "btn",
        "onTertiary": "btnFg",
    }
    lines = [f"    val {name} = MaterialScheme("]
    for field, key in mapping.items():
        lines.append(f"        {field} = {kotlin_color(colors[key])},")
    lines.append("    )")
    return "\n".join(lines)


def render_kotlin(data: dict) -> str:
    return "\n".join(
        [
            "// Generated from tokens/zoetrik.json. Do not edit by hand.",
            "package com.hermesbots.phase0",
            "",
            "import androidx.compose.ui.graphics.Color",
            "",
            "data class MaterialScheme(",
            "    val primary: Color,",
            "    val onPrimary: Color,",
            "    val background: Color,",
            "    val onBackground: Color,",
            "    val surface: Color,",
            "    val onSurface: Color,",
            "    val surfaceVariant: Color,",
            "    val onSurfaceVariant: Color,",
            "    val outline: Color,",
            "    val error: Color,",
            "    val tertiary: Color,",
            "    val onTertiary: Color,",
            ")",
            "",
            "object ZoetrikColors {",
            kotlin_scheme("Light", data["light"]),
            kotlin_scheme("Dark", data["dark"]),
            "}",
            "",
        ]
    )


def channel(value: int) -> float:
    scaled = value / 255
    if scaled <= 0.04045:
        return scaled / 12.92
    return ((scaled + 0.055) / 1.055) ** 2.4


def luminance(hex_color: str) -> float:
    raw = hex_color.removeprefix("#")
    red, green, blue = int(raw[0:2], 16), int(raw[2:4], 16), int(raw[4:6], 16)
    return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)


def contrast(foreground: str, background: str) -> float:
    lighter = max(luminance(foreground), luminance(background))
    darker = min(luminance(foreground), luminance(background))
    return (lighter + 0.05) / (darker + 0.05)


# Each foreground sits on these backgrounds. Button text is btnFg, not fg.
PAIRS = (
    ("fg", "bg"),
    ("fg", "bg2"),
    ("fg", "bg3"),
    ("fgMuted", "bg"),
    ("fgMuted", "bg2"),
    ("fgMuted", "bg3"),
    ("accentFg", "accent"),
    ("btnFg", "btn"),
    ("accent", "bg2"),
    ("accent", "bg3"),
    ("error", "bg"),
    ("error", "bg2"),
    ("error", "bg3"),
)


def check_contrast(data: dict) -> list[str]:
    problems = []
    for theme in ("light", "dark"):
        colors = data[theme]
        for foreground, background in PAIRS:
            ratio = contrast(colors[foreground], colors[background])
            if ratio < 4.5:
                problems.append(f"{theme} {foreground} on {background} is {ratio:.2f}:1")
    return problems


def main() -> int:
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    problems = check_contrast(data)
    if problems:
        print("token contrast is below WCAG AA 4.5:1", file=sys.stderr)
        for problem in problems:
            print(problem, file=sys.stderr)
        return 1
    text = render()
    kotlin = render_kotlin(data)
    if "--check" in sys.argv:
        current = CSS.read_text(encoding="utf-8") if CSS.exists() else ""
        if current != text:
            print("tokens/zoetrik.css is stale. Run tokens/build_tokens.py", file=sys.stderr)
            return 1
        current_kotlin = KOTLIN.read_text(encoding="utf-8") if KOTLIN.exists() else ""
        if current_kotlin != kotlin:
            print(f"{KOTLIN} is stale. Run tokens/build_tokens.py", file=sys.stderr)
            return 1
        print("tokens match zoetrik.json")
        return 0
    CSS.write_text(text, encoding="utf-8")
    KOTLIN.write_text(kotlin, encoding="utf-8")
    print(f"wrote {CSS}")
    print(f"wrote {KOTLIN}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

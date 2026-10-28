#!/usr/bin/env python3
"""Write Zoetrik CSS and a Kotlin colour table from tokens/zoetrik.json."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "zoetrik.json"
CSS = ROOT / "zoetrik.css"

MAP = {
    "bg": "bg",
    "bg2": "bg-2",
    "bg3": "bg-3",
    "btn": "btn",
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


def main() -> int:
    text = render()
    if "--check" in sys.argv:
        current = CSS.read_text(encoding="utf-8") if CSS.exists() else ""
        if current != text:
            print("tokens/zoetrik.css is stale. Run tokens/build_tokens.py", file=sys.stderr)
            return 1
        print("tokens match zoetrik.json")
        return 0
    CSS.write_text(text, encoding="utf-8")
    print(f"wrote {CSS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

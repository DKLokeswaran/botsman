#!/usr/bin/env python3
"""Regression tests for design-token and styling contracts."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

TOKENS = Path(__file__).resolve().parent
ROOT = TOKENS.parent
sys.path.insert(0, str(TOKENS))

from build_tokens import contrast  # noqa: E402

WINDOWS_STYLES = ROOT / "apps/windows/src/styles.css"


class CopyButtonContrastRegression(unittest.TestCase):
    def test_bug_light_mode_copy_button_contrast(self) -> None:
        data = json.loads((TOKENS / "zoetrik.json").read_text(encoding="utf-8"))
        styles = WINDOWS_STYLES.read_text(encoding="utf-8")
        self.assertIn("background: var(--bg-3)", styles)
        self.assertRegex(
            styles,
            r"\.fence-bar button[^}]*color:\s*var\(--accent\)",
            msg="Windows code-card Copy label should use --accent on --bg-3",
        )
        light = data["light"]
        ratio = contrast(light["accent"], light["bg3"])
        self.assertGreaterEqual(
            ratio,
            4.5,
            f"light accent on bg3 is {ratio:.2f}:1; code-card Copy uses this pair",
        )

    def test_dark_mode_copy_button_contrast_unchanged(self) -> None:
        data = json.loads((TOKENS / "zoetrik.json").read_text(encoding="utf-8"))
        dark = data["dark"]
        ratio = contrast(dark["accent"], dark["bg3"])
        self.assertGreaterEqual(ratio, 4.5)


if __name__ == "__main__":
    raise SystemExit(unittest.main())

# Regression catalog

## 2026-10-28 — Light mode code-card Copy contrast (WCAG AA)

**Bug:** On the chat screen with an approval card, the markdown code-fence **Copy** label used `var(--accent)` on the code card background `var(--bg-3)`. In light mode that pair was 4.41:1 (below WCAG AA 4.5:1). Dark mode was already compliant.

**Fix:** Darken light-theme `accent` in `tokens/zoetrik.json` to `#b43208` so `accent` on `bg3` reaches 4.51:1. Token checks now include `accent` on `bg2` and `bg3`. Android `ZoetrikColors.kt` is generated from the same JSON.

**Tests (`test_bug_light_mode_copy_button_contrast`):**

| Platform | Location |
| --- | --- |
| Tokens + Windows CSS contract | `tokens/test_regressions.py` |
| Windows | `apps/windows/contrast.regression.test.mjs` (Node built-in test) |
| Android | `apps/android/app/src/test/kotlin/com/hermesbots/phase0/CopyButtonContrastRegression.kt` |

**CI:** `python3 -m unittest tokens/test_regressions.py`, `node --test apps/windows/contrast.regression.test.mjs`, and `:app:testDebugUnitTest` on Ubuntu.

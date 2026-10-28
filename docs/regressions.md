# Regressions

Failures worth keeping a test for. Each name below is a test, dated when it was added.

| Date | Bug | Test |
| --- | --- | --- |
| 2026-10-28 | One-line fenced code blocks rendered as plain monospace without a code card, language label, or Copy. Android uses the same card, the label `text` when the fence has no language, the info-string token with its original casing, and the same fence body, including blank lines. | `test_bug_windows_one_line_codeblock`, `test_bug_windows_one_line_codeblock_android_parity` |
| 2026-10-28 | Neither client scrolled to the latest message after Send; users had to scroll manually. Fixed with shared near-bottom follow rules, forced scroll on Send, and a Jump to latest affordance when reading history. | `test_bug_no_autoscroll_on_send` (Windows TS, Android Kotlin), Roborazzi `test_bug_no_autoscroll_on_send` on Android |

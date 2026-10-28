# Regression log

## 2026-10-28 — Chat does not scroll on Send

Neither client scrolled to the latest message after Send; users had to scroll manually. Fixed with shared near-bottom follow rules, forced scroll on Send, and a Jump to latest affordance when reading history. Tests: `test_bug_no_autoscroll_on_send` (Windows TS, Android Kotlin), Roborazzi `test_bug_no_autoscroll_on_send` on Android.

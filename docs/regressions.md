| Date | Bug | Test |
| --- | --- | --- |
| 2026-10-28 | One-line fenced code blocks rendered as plain monospace without a code card, language label, or Copy. Android uses the same card, the label `text` when the fence has no language, the info-string token with its original casing, and the same fence body, including blank lines. | `test_bug_windows_one_line_codeblock`, `test_bug_windows_one_line_codeblock_android_parity` |

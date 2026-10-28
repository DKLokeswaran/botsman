# Regressions

Browser coverage for the Windows client. The suite lives in `apps/windows/e2e` and runs Playwright against a production Vite build (`vite build` then `vite preview`) and `contract/fake/hermes_fake.py`. Tauri calls are replaced by shims that the e2e Vite mode aliases in. The installer build does not load that config.

A test whose name starts with `test_bug_` is listed below. Rows whose test is declared with `test.fixme` are placeholders. Delete `test.fixme` on that test when the bug is fixed so the assertion runs in CI.

## Run locally

From a checkout with Node 22 and Python 3:

```bash
cd apps/windows
npm ci
npx playwright install --with-deps chromium
npm run e2e
```

`npm run e2e` checks that a default `vite build` does not contain the shim, typechecks the suite, then starts the fake with `HERMES_FAKE_TEST_HOOKS=1` and the preview server. The HTML report is `apps/windows/e2e/playwright-report`. Screenshots are `apps/windows/e2e/test-results`. Open the report with:

```bash
npx playwright show-report e2e/playwright-report
```

Leave `HERMES_FAKE_TEST_HOOKS` unset for contract tests and the notifier. The fake's login, tickets, and JSON-RPC replies are unchanged without it.

## Tests

| Date | Bug | Platform | Test name |
| --- | --- | --- | --- |
| 2026-10-28 | Exactly one approval card, rendered at the bottom of the session | Windows | test_bug_one_approval_card_at_bottom |
| 2026-10-28 | Approving on one device clears the card or marks it on the other device | Windows | test_bug_approval_clears_or_marks_on_other_device |
| 2026-10-28 | Markdown lists render, and a multi-line fenced block with a language shows its label, colours, and Copy. Copy puts the code on the clipboard | Windows | test_bug_markdown_list_and_fenced_code |
| 2026-10-28 | A long user message collapses after about 6 lines, with Show more and Show less | Windows | test_bug_long_user_message_collapses |
| 2026-10-28 | A notification tap opens the session with the approval card or the reply highlighted | Windows | test_bug_notification_deep_link_highlights |
| 2026-10-28 | Light-mode button contrast is at least 4.5:1 on every button, from computed style | Windows | test_bug_light_mode_button_contrast |
| 2026-10-28 | The version label is visible on the login screen and in About | Windows | test_bug_version_label_on_login_and_about |
| 2026-10-28 | One-line code fence without a language (placeholder, test.fixme) | Windows | test_bug_one_line_code_fence_without_language |
| 2026-10-28 | Deny shows as Denied on the other device, and the card does not leak into other sessions (placeholder, test.fixme) | Windows | test_bug_deny_scoped_to_session |
| 2026-10-28 | The conversation auto-scrolls after Send (placeholder, test.fixme) | Windows | test_bug_autoscroll_after_send |
| 2026-10-28 | A message from device A appears live on device B (placeholder, test.fixme) | Windows | test_bug_message_syncs_to_other_device |

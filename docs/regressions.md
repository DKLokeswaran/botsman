# Regressions

Failures worth keeping a test for. Each name below is a test, dated when it was added. The same name is used in the TypeScript client, the Kotlin client, and both apps when the bug crosses that boundary.

Hermes `request.cancel` uses reason `resolved` for every committed approval, including deny, and the payload has no choice. A single global approval slot then showed **Approved on another device** in every chat until the next card.

`sessions.changed` is an empty broadcast when `state.db` moves. Plain user text is not a session event (`message.start` is empty). A socket only receives live session events after `session.resume` or `session.activate`, and those attach alongside sockets that are already attached.

The session-sync app tests live in `apps/windows/test/session-sync.test.ts` and `apps/android/app/src/test/kotlin/com/hermesbots/phase0/Phase0ModelSyncTest.kt`. The notification test lives in `Phase0NotificationTest.kt`. The socket tests live in `contract/ts/test/client.test.ts` and `contract/kotlin/src/test/kotlin/com/hermesbots/gateway/HermesClientTest.kt`, against `contract/fake/hermes_fake.py`.

Browser coverage for the Windows client lives in `apps/windows/e2e` and runs Playwright against a production Vite build (`vite build` then `vite preview`) and `contract/fake/hermes_fake.py`. Tauri calls are replaced by shims that the e2e Vite mode aliases in. The installer build does not load that config. The browser tests drive the app the same way it attaches in production: opening a session calls `session.resume`, which is what subscribes that socket to `message.*`, `tool.complete`, and `request.cancel`.

## Run the browser suite locally

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

| Date | Bug | Test |
| --- | --- | --- |
| 2026-10-28 | One-line fenced code blocks rendered as plain monospace without a code card, language label, or Copy. Android uses the same card, the label `text` when the fence has no language, the info-string token with its original casing, and the same fence body, including blank lines. | `test_bug_windows_one_line_codeblock`, `test_bug_windows_one_line_codeblock_android_parity` |
| 2026-10-28 | Neither client scrolled to the latest message after Send; users had to scroll manually. Shared near-bottom follow rules force a scroll on Send and show Jump to latest when the reader is up in history. | `test_bug_no_autoscroll_on_send` (Windows TS, Android Kotlin), Roborazzi `test_bug_no_autoscroll_on_send` on Android |
| 2026-10-28 | The answering device shows Allowed once, Allowed for session, Always allowed, or Denied. Another device starts at Answered on another device, then Denied on another device when `tool.complete` contains `BLOCKED:` and `denied by user`, or Approved on another device when the tool runs. A `BLOCKED:` result that is not a user deny stays Answered on another device. | `test_bug_deny_shown_as_denied_on_the_other_device` |
| 2026-10-28 | A card is stored by `session_id` and is visible only while that session is open. | `test_bug_approval_does_not_leak_into_other_sessions` |
| 2026-10-28 | A collapsed line is removed by `expireResolved` (the apps arm this at 5 seconds) or by a newer message. `timeout` reads Timed out. `interrupted`, `shutdown`, and `session_closed` remove the card with no label, matching the desktop client. `approval.cancelled` removes only the listed `request_ids`. | `test_bug_resolved_card_clears` |
| 2026-10-28 | History merge keeps in-flight assistant text, dedupes an optimistic send by text, and appends a row that arrived from the other device. | `test_bug_history_merge_message_from_other_device` |
| 2026-10-28 | Two attached sockets: a `prompt.submit` on A is in B's `session.history` after `sessions.changed`. A socket attached to a different session does not receive A's `message.delta` or `message.complete`. | `test_bug_message_from_socket_a_appears_for_socket_b` |
| 2026-10-28 | `request.cancel` reason is `resolved` and the payload has no `choice`. Deny is followed by `tool.complete` whose result contains `BLOCKED:` and `denied by user`. | `test_bug_deny_cancel_has_no_choice` |
| 2026-10-28 | `session.interrupt` emits broadcast `approval.cancelled` with the server request id and the approval `request_id`. | `test_bug_approval_cancelled_names_request_ids` |
| 2026-10-28 | Android only. The approval notification's Allow once and Deny actions carry the same answer (`once` or `deny`) into the app. The notification id is the approval `request_id`, and it is removed when that card leaves the open state. | `test_bug_notification_cleared_when_answered_elsewhere` |
| 2026-10-28 | Exactly one approval card, rendered at the bottom of the session. | `test_bug_one_approval_card_at_bottom` |
| 2026-10-28 | Approving on one device clears the card or marks it on the other device. | `test_bug_approval_clears_or_marks_on_other_device` |
| 2026-10-28 | Markdown lists render, and a multi-line fenced block with a language shows its label, colours, and Copy. Copy puts the code on the clipboard. | `test_bug_markdown_list_and_fenced_code` |
| 2026-10-28 | A long user message collapses after about 6 lines, with Show more and Show less. | `test_bug_long_user_message_collapses` |
| 2026-10-28 | A notification tap opens the session with the approval card or the reply highlighted. | `test_bug_notification_deep_link_highlights` |
| 2026-10-28 | Light-mode button contrast is at least 4.5:1 on every button, from computed style. | `test_bug_light_mode_button_contrast` |
| 2026-10-28 | The version label is visible on the login screen and in About. | `test_bug_version_label_on_login_and_about` |
| 2026-10-28 | A one-line code fence without a language renders as a code card with a label, highlighting, and Copy. | `test_bug_one_line_code_fence_without_language` |
| 2026-10-28 | Deny shows as Denied on the other device, and the card does not leak into other sessions. | `test_bug_deny_scoped_to_session` |
| 2026-10-28 | The conversation auto-scrolls after Send. | `test_bug_autoscroll_after_send` |
| 2026-10-28 | A message from device A appears live on device B. | `test_bug_message_syncs_to_other_device` |

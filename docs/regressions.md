# Regressions

Failures worth keeping a test for. Each name below is a test, dated when it was added. The same name is used in the TypeScript client, the Kotlin client, and both apps when the bug crosses that boundary.

## 2026-10-28

Hermes `request.cancel` uses reason `resolved` for every committed approval, including deny, and the payload has no choice. A single global approval slot then showed **Approved on another device** in every chat until the next card.

`sessions.changed` is an empty broadcast when `state.db` moves. Plain user text is not a session event (`message.start` is empty). A socket only receives live session events after `session.resume` or `session.activate`, and those attach alongside sockets that are already attached.

| Test | What it locks |
| --- | --- |
| `test_bug_deny_shown_as_denied_on_the_other_device` | The answering device shows Allowed once, Allowed for session, Always allowed, or Denied. Another device starts at Answered on another device, then Denied on another device when `tool.complete` contains `BLOCKED:` and `denied by user`, or Approved on another device when the tool runs. A `BLOCKED:` result that is not a user deny stays Answered on another device. |
| `test_bug_approval_does_not_leak_into_other_sessions` | A card is stored by `session_id` and is visible only while that session is open. |
| `test_bug_resolved_card_clears` | A collapsed line is removed by `expireResolved` (the apps arm this at 5 seconds) or by a newer message. `timeout` reads Timed out. `interrupted`, `shutdown`, and `session_closed` remove the card with no label, matching the desktop client. `approval.cancelled` removes only the listed `request_ids`. |
| `test_bug_history_merge_message_from_other_device` | History merge keeps in-flight assistant text, dedupes an optimistic send by text, and appends a row that arrived from the other device. |
| `test_bug_message_from_socket_a_appears_for_socket_b` | Two attached sockets: a `prompt.submit` on A is in B's `session.history` after `sessions.changed`. A socket attached to a different session does not receive A's `message.delta` or `message.complete`. |
| `test_bug_deny_cancel_has_no_choice` | `request.cancel` reason is `resolved` and the payload has no `choice`. Deny is followed by `tool.complete` whose result contains `BLOCKED:` and `denied by user`. |
| `test_bug_approval_cancelled_names_request_ids` | `session.interrupt` emits broadcast `approval.cancelled` with the server request id and the approval `request_id`. |
| `test_bug_notification_cleared_when_answered_elsewhere` | Android only. The approval notification's Allow once and Deny actions carry the same answer (`once` or `deny`) into the app. The notification id is the approval `request_id`, and it is removed when that card leaves the open state. |

The app tests live in `apps/windows/test/session-sync.test.ts` and `apps/android/app/src/test/kotlin/com/hermesbots/phase0/Phase0ModelSyncTest.kt`. The notification test lives in `Phase0NotificationTest.kt`. The socket tests live in `contract/ts/test/client.test.ts` and `contract/kotlin/src/test/kotlin/com/hermesbots/gateway/HermesClientTest.kt`, against `contract/fake/hermes_fake.py`.

# Known issues

Low-severity issues in the `hermes-bots` plugin, its contract and its tests. None of them affects normal routine delivery or alerts.

## Delivery and routine output

| Issue | Where | Effect | Suggested fix |
| --- | --- | --- | --- |
| A routine name containing a newline breaks the routine message format | `plugin/hermes-bots/routine_output.py` (`parse_target`, `routine_message`) | A name such as `Morning%0Abriefing` produces `[Routine: Morning\nbriefing]`, which does not match `RoutineMessage` in the contract, so the apps show it as a plain bot message | Replace control characters in the decoded name with spaces |
| The cron footer stays in the output when the output ends with whitespace after it | `plugin/hermes-bots/routine_output.py` (`_WRAPPED`) | "To stop or manage this job…" lands in the chat. Hermes's cron output has not ended with whitespace so far | Allow trailing whitespace before `\Z`, or strip the content first |
| The footer match depends on its exact English wording | `plugin/hermes-bots/routine_output.py` (`_WRAPPED`) | If Hermes rewords the footer, it lands in the chat | Match the header and separator strictly and the footer loosely, and log when it does not match |
| `parse_target` accepts a target without a routine name | `plugin/hermes-bots/routine_output.py` | `session-<id>` is delivered as "Routine", although the contract's `DeliverTarget` requires `/<name>` | Refuse a target without the `/<name>` part |
| `format_target` does not check the session id | `plugin/hermes-bots/routine_output.py` | A session id containing `/` or `,` would produce a target that is parsed wrongly. Hermes session ids contain only digits, `_` and hex | Raise when the session id contains `/` or `,` |
| One failing row delays the later rows of the same chat | `plugin/hermes-bots/store.py` (`_CLAIMABLE_SQL`) | A row in error backoff holds back the chat's later routines for up to about a minute. This keeps routines in order | State the ordering choice in a comment above the query |
| Delivered routine text stays in the store for 7 days | `plugin/hermes-bots/store.py` (`finish_delivery`, `prune`) | The shared store holds a second copy of routine output until pruning | Clear `text` when a row is finished |
| `send` and `_standalone_send` repeat the same queue-and-log code | `plugin/hermes-bots/__init__.py` | Two copies to keep in step | Move the shared part into one helper |

## Alerts and the alert stream

| Issue | Where | Effect | Suggested fix |
| --- | --- | --- | --- |
| The turn-start map is trimmed only by age | `plugin/hermes-bots/alerts.py` (`_remember_turn_start`) | More than 2,000 turns started within 24 hours are all kept until they are 24 hours old. The memory used is small | Also drop the oldest entries when the map is over its cap |
| A malformed `since` uses up the one-time ticket | `plugin/hermes-bots/dashboard/plugin_api.py` (`alerts`) | The client gets the same HTTP 403 as for a bad ticket and cannot tell the two apart | Check `since` before the login check, still before accepting, and document the refusal |
| The subprotocol echo relies on a private Hermes attribute | `plugin/hermes-bots/dashboard/plugin_api.py` (`_hermes_ws_subprotocol`) | If Hermes renames it, clients that send the ticket as a subprotocol cannot connect | The integration tests cover it; run them before every Hermes upgrade |
| Hook alerts may name a different chat id than routine alerts after a chat is compressed | `plugin/hermes-bots/alerts.py` | Unverified. Hook alerts use the session id Hermes passes, which may be a continuation id; the contract promises the stored id | Check on a test instance after a compression, then resolve to the stored id or reword the contract |

## Contract and docs

| Issue | Where | Effect | Suggested fix |
| --- | --- | --- | --- |
| The README's ping example leaves out `latest_alert_id` | `plugin/README.md` (Alert stream) | The code and the contract's `Ping` include it | Show the full ping message and say what the field holds: the last alert id sent on this stream |
| `ARCHITECTURE.md` does not say the routine name in the target is percent-encoded | `docs/research/ARCHITECTURE.md` (Routines) | The code, README and contract require it, because cron splits targets on commas | Say "percent-encoded routine name" there |

## Tests

| Issue | Where | Effect | Suggested fix |
| --- | --- | --- | --- |
| The integration ping test passes on any message | `plugin/tests/integration/test_alert_socket.py` (`test_a_quiet_stream_pings`) | It does not prove a live dashboard sends pings. The unit test `test_a_quiet_stream_pings` in `plugin/tests/unit/test_plugin_api.py` does | Assert the message type is `ping` on a stream that starts after the newest alert |
| Unused `monkeypatch` parameters | `plugin/tests/integration/test_alert_socket.py` (`test_a_quiet_stream_pings`), `plugin/tests/unit/test_alerts.py` (`test_the_first_start_of_a_turn_counts`) | Noise in the test signatures | Remove them |

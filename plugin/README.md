# Hermes Bots companion plugin

The `hermes-bots` Hermes plugin serves the Hermes Bots apps. It needs Hermes v0.22.5.

- **Routine delivery.** The `hbapp` delivery platform writes a routine's output into a bot's chat as the bot's own message, without starting a turn. If a reply is running in that chat, the write waits until it ends.
- **Alerts.** Approvals, questions, long replies and routine results raise alerts. Alerts carry no conversation text.
- **Alert stream.** One authenticated WebSocket streams every bot's alerts to the apps.

The design and the Hermes constraints behind it are in [ARCHITECTURE.md](../docs/research/ARCHITECTURE.md) and [BLOCKERS.md](../docs/research/BLOCKERS.md).

## Layout

| Path | Contents |
| --- | --- |
| `plugin/hermes-bots/` | The plugin as Hermes installs it |
| `plugin/hermes-bots/__init__.py` | Registers the `hbapp` platform and the hooks |
| `plugin/hermes-bots/routine_output.py` | Delivery targets and the shapes of cron output |
| `plugin/hermes-bots/delivery.py` | Delivery queue and the worker that writes into chats under the turn lease |
| `plugin/hermes-bots/alerts.py` | Hooks that raise alerts |
| `plugin/hermes-bots/app_chat.py` | Which session is the bot's app chat, from the profile's `ui_meta` |
| `plugin/hermes-bots/store.py` | Shared SQLite store at the Hermes root |
| `plugin/hermes-bots/dashboard/` | Dashboard routes: `GET /info` and the `/alerts` WebSocket |
| `plugin/contract/` | JSON Schema for the info response, alert messages, delivery targets and routine messages |
| `plugin/tests/unit/` | Tests that run without Hermes |
| `plugin/tests/integration/` | Tests against a Hermes test instance |

The version lives in `plugin/hermes-bots/version.py`. `plugin/hermes-bots/plugin.yaml` and `plugin/hermes-bots/dashboard/manifest.json` repeat it, and a unit test checks that all three agree.

## Install

Hermes loads plugins per profile, so the plugin is installed into every bot's profile. The apps do this through `plugins.manage` on `/api/ws`:

```json
{"action": "install", "identifier": "<git url>#plugin/hermes-bots", "ref": "<40-character commit SHA>",
 "enable": true, "profile": "<bot>"}
```

An update is the same call with `"force": true` and the new `ref`, because a profile that already has the plugin refuses a second install without it, and a pinned install refuses `action: "update"`. A first install goes without `force`, so Hermes's security scan can still stop it. After an install or an update:

1. Restart the gateway (`POST /api/gateway/restart`, which relies on a supervisor such as a systemd service) so that `hbapp` connects with the new code.
2. Restart the dashboard (for example `systemctl --user restart hermes-dashboard.service`) when `GET /api/plugins/hermes-bots/info` reports an older version than `plugins.manage {action: "list"}`. Hermes has no API for this restart.

No `platforms:` config and no environment variables are needed.

### Profile settings

| Setting | Value | Why |
| --- | --- | --- |
| `approvals.mode` | `manual` | Hermes's default, `smart`, lets a model approve commands with nobody asked, so no approval alert is raised. The apps set `manual` in each bot's profile when they connect |
| `approvals.timeout` | Longer than the default 300 s | Gives time to answer from a phone before Hermes denies the request |
| The gateway | Always running | Only the gateway runs scheduled routines; Run now works without it |

## Routines

A routine delivers into a chat with this `deliver` value:

```
hbapp:session-<stored session id>/<percent-encoded routine name>
```

The plugin removes cron's `Cronjob Response` header and footer when present and writes the output as an assistant-role row:

```
[Routine: <routine name>]
<output>
```

Output that starts with one of Hermes's cron failure notices is a failed run: `⚠️ Cron '<name>' failed:`, `⛔ Cron '<name>' did not run:`, `⚠ Cron job '<name>' was auto-paused`, `⚠ Cron watchdog '<name>' script failed` or `⚠ Cron monitor '<name>' source failed`. It is written the same way and raises `routine_failed`.

Routines deliver text only. Attachments a routine produces (`MEDIA:` tags) are not delivered: on a scheduled run Hermes records them in the run's delivery error, and on Run now they are dropped. Neither posts anything else to the chat.

Delivery returns at once and queues the row in the shared store. A background worker writes it while it holds the chat's turn lease, retrying every 2 s while a reply runs. Every process that loads the plugin runs the worker, so rows a stopped process left queued are written by the next one. If a reply holds the chat for 15 minutes without a break, or the chat does not exist, the worker drops the row and raises `routine_failed`.

## Alerts

| Kind | Raised when | `ref` |
| --- | --- | --- |
| `approval` | A person is asked to approve a command | Hook request id |
| `question` | A person is asked clarifying questions | Hook request id |
| `resolved` | That request was answered, denied or timed out | Same request id |
| `finished` | A completed reply ran for at least 60 s (`HERMES_BOTS_FINISHED_AFTER_S`) | Turn id |
| `error` | A reply failed | Turn id |
| `routine` | Routine output was written into the chat | none |
| `routine_failed` | A routine reported a failure, or its output could not be written | none |

Hook alerts (`approval`, `question`, `resolved`, `finished`, `error`) are raised only for the bot's app chat: its own session, the sessions it continued in after compressions, and the sessions of subagents it delegated to. They always name the chat's stored id. The bot's other sessions, such as other dashboard chats, the CLI and messaging platforms, raise none and work as configured; a bot with no recorded chat raises no hook alerts.

The apps record that chat right after `session.create`, before its first turn, with this procedure (`AppChatRecord` in the contract):

1. Read the bot's `ui_meta` and `ui_meta_revisions` from `profiles.list`.
2. If `ui_meta["hermes-bots-app"]` names a chat, use it.
3. Otherwise create the chat and write `profiles.configure {name: <bot>, ui_meta: {"hermes-bots-app": {"chat_session_id": <stored id>}}, ui_meta_expected_revisions: {"hermes-bots-app": <revision read>}}`. Send the whole record: the write replaces the `hermes-bots-app` object.
4. If the write reports a conflict, another device recorded a chat first: read it again and use that chat.

Routine runs, turns of delegated subagents and interrupted replies raise no hook alerts. Alerts are kept for 7 days.

### Alert stream

```
GET  /api/plugins/hermes-bots/info
WS   /api/plugins/hermes-bots/alerts?ticket=<ticket>&since=<last alert id>
```

- Call `/info` before opening the socket. On a dashboard that just installed the plugin, this request is what mounts the socket route.
- Get the ticket from `POST /api/auth/ws-ticket`. It works once and expires after 30 s. The ticket can also go in the `hermes-gateway-v1` subprotocol pair, as for `/api/ws`. The socket refuses, with an HTTP 403 at the handshake, every connection `/api/ws` would refuse: one without a valid ticket, one from a refused Host or Origin, one carrying the Desktop app's `X-Hermes-Gateway-Ticket` header, and every connection while the dashboard's chat is switched off.
- Without `since`, the stream starts after the newest alert. With it, the stream first replays every alert after that id. A `since` above the newest alert makes the stream replay every alert the store still keeps.
- `/info` and every ping carry the store's `store_id`, a random id set when the store file is created. A different id means the store was recreated, for example because its file was deleted or the Hermes root was rebuilt, and its alert ids restarted. The client acts on it in one of two ways:
  - In `/info`, before or between streams: it reconnects with `since=0`.
  - In a ping on an open stream: it resets its last-seen id to 0 and keeps reading. The stream sends that ping as soon as the store is recreated, then the new store's alerts from the start, so reconnecting would receive them twice.
- A quiet stream sends `{"type": "ping", "latest_alert_id": <last id sent>, "store_id": <id>}` every 20 s.

Only the launch profile's dashboard can serve the socket. It streams alerts for every bot.

## Tests

```bash
cd plugin
uv venv .venv && uv pip install -p .venv/bin/python -r requirements-dev.txt
.venv/bin/python -m pytest tests/unit
```

The integration tests need a separate Hermes test instance; never point them at a live one. Install the working tree into two profiles, restart the instance's gateway and dashboard with `HERMES_BOTS_FINISHED_AFTER_S=5` in their environment, then run:

```bash
export HB_TEST_URL=http://<host>:<port> HB_TEST_USER=<user> HB_TEST_PASSWORD_FILE=<file>
.venv/bin/python tests/integration/install_plugin.py <scratch git repo> default <second profile>
# restart the test gateway and dashboard here
HB_TEST_HOME=<instance HERMES_HOME> HB_TEST_PROFILES=default,<second profile> \
HB_TEST_PROFILE_WITHOUT_PLUGIN=<profile without the plugin> .venv/bin/python -m pytest tests
```

`plugin/tests/integration/install_plugin.py` copies the working tree into the scratch Git repo and commits it there, so the install uses the same `<git url>#plugin/hermes-bots` identifier and commit `ref` as the apps. The integration tests run real model turns, and they cover the private Hermes functions the plugin relies on: the session turn lease, `append_message`, and the WebSocket credential and Origin checks. Run them before every Hermes upgrade.

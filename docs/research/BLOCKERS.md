# Hermes Bots: feasibility blockers

This document lists the constraints that decide whether Hermes Bots can be built as specified. They come from Hermes Agent itself, from the platforms (Android, Windows, push delivery), from the network and hosting setup, and from the architecture. UI bugs, app bugs and process issues are out of scope.

Hermes Bots is a custom Windows and Android client for a self-hosted Hermes Agent **v0.22.5**. It needs:

- per-profile bots, each with one chat
- routines (cron) that post into the bot's chat without starting a turn, with replies in context
- streaming replies and live tool activity
- inline approvals and clarifying questions
- session history, synced across devices
- push notifications when the apps are closed

The architecture that answers these constraints is in [ARCHITECTURE.md](ARCHITECTURE.md).

## Evidence base

- **Hermes source.** `hermes-agent` at commit `bf0203a794` (tag v0.22.5, 2026-10-23), the tree the devbox instance runs. File references below are paths in that tree.
- **Live tests on devbox, 2026-10-30.** One routine delivered into the main profile's Bot Chat, a reply sent from a dashboard client, and the logs of both Hermes processes.
- **Test-instance runs, 2026-10-30.** A throwaway Hermes on port 9129 with its own `HERMES_HOME`, its own gateway, no messaging platforms, and test plugins: hook loggers, a Bot Chat bridge, and a routine delivery platform installed through `plugins.manage`.
- **Device tests, 2026-10-30.** Messages to an Android phone with the app in the background: three through ntfy.sh, and three through a foreground-service connection to the devbox over Tailscale.
- **Plugin spike, 2026-10-31.** A throwaway Hermes on the Tailscale IP, port 9129, with its own `HERMES_HOME`, `HERMES_GATEWAY_LOCK_DIR` and `XDG_STATE_HOME`, basic auth, a gateway, and three profiles (`default`, `spike2`, `spike3`). A spike `hermes-bots` plugin was installed from a local Git repo through `plugins.manage` into `default` and `spike2` and left out of `spike3`. It registered the `hbapp` platform, logged every hook to a shared SQLite file, and served `GET /info` and the alerts WebSocket. The production instance kept its PIDs and files throughout.
- **Repo docs.** `docs/research/REPORT.md`, `docs/research/LATER-FINDINGS.md`, and the phase-0 branch `cursor/phase0-integration:docs/regressions.md`.

Items not confirmed by source or by a test are marked **(unverified)**.

## Summary

| # | Constraint | Area | Needs a Hermes code change? | Verdict |
|---|---|---|---|---|
| B1 | Hermes has no device push channel | Hermes | No (plugin) | Manageable |
| B2 | Android stops background connections when the app is closed | Platform / network | No | Manageable |
| B3 | No global "approval pending" event on the socket | Hermes architecture | No (plugin) | Manageable |
| B4 | A routine's own run can never ask for approval | Hermes | No | Manageable |
| B5 | Approvals time out and fail closed after 300 s | Hermes | No (config) | Manageable |
| B6 | Runtime session ids are short-lived | Hermes architecture | No | Manageable |
| B7 | Live-event replay is bounded and resets on restart | Hermes | No | Manageable |
| B8 | Fast-moving gateway protocol with no deprecation period | Hermes | No (pinning) | Serious risk |
| B9 | `request.cancel` does not say how a request was resolved | Hermes protocol | No | Manageable |
| B10 | Remote access rules: login, Host check, CORS, one user | Hermes / network | No | Manageable |
| B11 | Everything depends on Tailscale and one devbox | Network / hosting | No | Manageable, single point of failure |
| B12 | Testing needs a separate Hermes instance | Architecture | No | Manageable |
| B13 | Windows notification activation and unsigned installer | Platform | No | (unverified) |
| B14 | Bot Chat runs in the gateway process, out of the dashboard's reach | Hermes architecture | No | Avoided (Bot Chat not used) |
| B15 | Routine delivery into Bot Chat always starts an agent turn | Hermes | No (plugin) | Manageable |
| B16 | Routine output written during a running reply is lost to the model | Hermes | No (plugin) | Manageable |
| B17 | Plugin WebSocket routes are not behind the dashboard login | Hermes | No (plugin) | Manageable |
| B18 | Plugins are installed per profile; secondary profiles get no plugin WebSockets | Hermes architecture | No | Manageable |
| B19 | Plugin updates need a gateway and a dashboard restart; version reporting is uneven | Hermes | No | Manageable |
| B20 | A user-role routine row merges with the user's next message | Hermes | No (plugin) | Manageable |
| B21 | Where routines run: the gateway ticks them, Run now runs in the dashboard | Hermes architecture | No | Manageable |

**Bottom line.** Hermes Bots is feasible as specified with stock Hermes v0.22.5 and a companion Hermes plugin. The plugin delivers routine output into chats and raises push alerts, and Android push goes through the app's own foreground service. B8 is the one serious risk left, and it is handled by pinning the Hermes version. Details are at the end.

---

## B1. Hermes has no device push channel

**Constraint.** Hermes v0.22.5 has no APNs, FCM, Web Push or UnifiedPush integration. `notification.show` is a toast sent down an open WebSocket, so with no client connected Hermes tells nobody.

**Workaround.** A Hermes plugin registers lifecycle hooks and sends the push itself. The hooks that matter:

- `pre_approval_request` and `post_approval_response`
- `on_human_input_request` and `on_human_input_resolved` (approvals and clarifying questions)
- `post_llm_call` and `on_session_end` (turn finished)

The hooks fire in whichever Hermes process runs the turn. The test instance confirmed this for the dashboard process, for an ordinary gateway session, and for the gateway's Bot Chat. A test plugin POSTed every hook event to an HTTP endpoint, and every POST arrived. No polling and no separate watcher service are needed.

What the hooks carry (plugin spike, 2026-10-31):

| Hook | Observed | Use for alerts |
|---|---|---|
| `on_human_input_request` | Fires only when a person is asked. `kind` is `approval` or `clarify`, plus `request_id` and `session_id` | "needs approval", "has a question" |
| `on_human_input_resolved` | Same `request_id`; `outcome` is `once`, `deny`, `submitted` and so on | Clear the pending alert |
| `pre_approval_request` / `post_approval_response` | Also fire when Hermes's `smart` approval mode lets an auxiliary model decide (`decided_by: aux_llm`) with nobody asked | Not used. They would alert for requests nobody sees |
| `pre_llm_call`, `post_llm_call`, `on_session_end` | Share `turn_id`, so the turn's length is the gap between `pre_llm_call` and `on_session_end` | "finished" for turns of 60 s or more |

- `on_session_end` also fires when a session's client disconnects, without `turn_id` and with `interrupted: true`. Those calls are not turn ends.
- Routine runs fire the same hooks with `task_id` starting `cron:<job id>:`. Routine results have their own alert, so these are skipped.
- No hook carries the profile. `hermes_cli.profiles.get_active_profile_name()` inside the callback returned the right profile for every turn.
- The `request_id` in `on_human_input_request` is not the `request_id` the client sees in its `approval` request. Alerts and client requests match on `session_id`.
- The approval mode is per profile and defaults to `smart` (`hermes_cli/config_defaults.py`). A new bot profile auto-approves many commands unless its config sets `approvals.mode: manual`.

Config-only outbound webhooks (`hooks.outbound`) exist too. They are registered by `hermes gateway run` and the chat commands, but not by the standalone `hermes dashboard` (`hermes_cli/main.py` lines 2835-2839 and 2945-2953) **(unverified by test)**. They also cannot set ntfy's title, priority or click headers, so the plugin is the better route.

**Verdict: manageable.**

## B2. Android delivery while the app is closed

**Constraint.** Android stops background network connections. Doze cuts network access for apps that are not exempt from battery optimisation, and phone makers such as Samsung, Xiaomi, Huawei, OnePlus, Oppo and Vivo add their own app-killing on top ([dontkillmyapp.com](https://dontkillmyapp.com)). Firebase Cloud Messaging is the only channel that is exempt by default, and it needs a Google project and a third-party relay.

Hermes Bots has no relay of its own, so the Android app must either keep its own connection alive or use a push service that has one. The devbox Hermes and ntfy listen only on the Tailscale IP, so a self-held connection also depends on the Tailscale VPN staying up. On 2026-10-30 at 03:11 IST, `tailscale status` showed the phone offline for 31 minutes. The build 39 logs (below) show the server accepting every notification and the phone showing none.

**Device test of a foreground service over Tailscale, 2026-10-30.** The ntfy app stood in for the app's own foreground service: subscribed to the devbox ntfy over Tailscale, ntfy and Tailscale set to Unrestricted battery, Tailscale set as always-on VPN, ntfy left in the background, phone locked. Samsung Galaxy A16.

| # | Sent (IST) | Phone state | Result |
|---|---|---|---|
| 1 | 15:15:29 | in use | arrived on time |
| 2 | 15:30:30 | locked 15 min | arrived on time |
| 3 | 18:28:37 | locked 60 min (Doze) | arrived on time |

The phone stayed connected to the tailnet throughout (`tailscale status` checked every 5 minutes).

**Device test on ntfy.sh, 2026-10-30.** Play Store build of ntfy, subscribed to a random topic on ntfy.sh, app swiped away, phone locked, no battery-optimisation exemption, Tailscale not needed.

| # | Sent (IST) | Phone state | Result |
|---|---|---|---|
| 1 | 05:12:01 | just locked | arrived on time |
| 2 | 05:27:11 | idle 15 min | arrived on time |
| 3 | 06:12:12 | idle 60 min (Doze) | arrived on time |

**Workaround.** Two push modes, chosen in the app:

- **Foreground service (default).** The Android app holds its own connection to Hermes over Tailscale in a foreground service. No dependency beyond Tailscale. At setup the app asks for the battery-optimisation exemption with the standard Android prompt and asks the user to make the VPN always-on. For phone makers with extra app-killing, the app links to that maker's page on dontkillmyapp.com. Swiping the app out of recents leaves the service running; Force stop ends it.
- **ntfy (optional).** The plugin publishes to an ntfy topic, and the ntfy app delivers it. With ntfy.sh, delivery uses FCM and needs no exemptions or VPN. ntfy.sh and Google see the topic and the timing, and ntfy.sh also sees the message text. Content-free messages ("Junior needs you") keep conversation text off third-party servers, and a topic reserved behind an ntfy.sh access token keeps others from reading it.

Long-term behaviour of the foreground service (several days, reboots, app updates) and behaviour on other phone makers are **(unverified)**.

**Verdict: manageable.**

## B3. No global "approval pending" event on the socket

**Constraint.** Approval and clarify requests go only to the owning session's transport (`tui_gateway/server.py` `write_json`, lines 697-714). The global broadcast (`_broadcast_global_event`, line 762) covers skin and display events, connection and onboarding events, `session.reclaimed`, `approval.cancelled` and the change-watcher events. `sessions.changed` has an empty payload. The watcher polls every 0.5 s and broadcasts at most once per 2 s (`tui_gateway/change_watcher.py` lines 381-419). `session.active_list` shows `waiting` for a pending request (`tui_gateway/session_registry.py` lines 648-650), but only for sessions in that process.

**Workaround.** The plugin hooks in B1 are the global signal for notifications. Answering a request still needs the connection that owns the session. Every chat turn runs in the dashboard, so that is the dashboard socket.

**Verdict: manageable.**

## B4. A routine's own run can never ask for approval

**Constraint.** The cron run uses `approvals.cron_mode`, a binary deny/approve setting that defaults to deny (`tools/approval_context.py` lines 346-359). Webhook and API-server platforms use `approvals.unattended_mode` in the same way (lines 175-190 and 366-371).

**What still works.** Routine output lands in a chat without starting a turn (B15). The user acts on it by replying in that chat. The reply is an ordinary dashboard turn, and its approvals reach the app as usual. So "a routine found something risky to do, and I approve it from my phone" works when the risky step happens in the reply.

Hermes's cron injection scanner also flags destructive commands written into a job prompt (observed: `destructive_root_rm`).

**Verdict: manageable.**

## B5. Approvals time out and fail closed

**Constraint.** `approvals.timeout` defaults to 300 s, after which the request is denied (`tools/approval_context.py` lines 305-323). The live test on 2026-10-30 hit this three times in one turn. Each tool call waited the full 300 s with nobody able to answer, then returned "BLOCKED ... timed out without user response".

**Workaround.** Raise `approvals.timeout` in config. A waiting turn blocks its session for that long.

**Verdict: manageable.**

## B6. Runtime session ids are short-lived

**Constraint.** Each session has a runtime id (8 hex characters, used by `session.activate`) and a stored id (used by `session.resume`). The wrong id gives `4007` or `4001`. A WebSocket session with no attached client is reaped after `HERMES_TUI_WS_ORPHAN_REAP_GRACE_S`, default 20 s (`tui_gateway/server.py` lines 139-146). The live test showed the reap 20 s after disconnect. Hermes keeps the session when the gateway's ledger still holds its turn ("Preserving session ... during ws_orphan_reap"). A restart drops every runtime id.

**Workaround.** Store stored ids, always resume by stored id, and map to the runtime id the server returns.

**Verdict: manageable.**

## B7. Bounded replay, none across restarts

**Constraint.** The replay ring holds 512 events and 4 MiB per session, at most 64 sessions, and 64 MiB per process (`tui_gateway/event_replay.py` lines 26-36). `replay_epoch` is regenerated per process and sent in `gateway.ready`.

**Workaround.** Treat a truncated replay or a new epoch as a reset and refetch history.

**Verdict: manageable.**

## B8. Fast-moving protocol

**Constraint.**

- The contract `apps/shared/src/gateway-contract.openrpc.json` reports `info.version: "1"`, has 258 methods and no deprecation flags.
- v0.21.6 → v0.22.0 removed six methods with no deprecation period: `session.start_chat` and five `onboarding.*` setup calls.
- There were 8 stable tags in 15 days: v0.21.6 (10-08), v0.21.7 (10-12), v0.22.0 and v0.22.1 (10-14), v0.22.2 (10-15), v0.22.3 and v0.22.4 (10-21), v0.22.5 (10-23).
- The 30 days to 2026-10-23 saw 15,189 commits: 782 touch `tui_gateway/` and 206 touch the contract file.
- If `session_authority` is set, legacy session-writer methods are refused.

**Version signals a client can read.**

- `session.info.desktop_contract`, currently `8` (`tui_gateway/server.py` lines 1486 and 1609). This is the compatibility integer.
- `version` in `/api/status`.
- `gateway.ready` and `gateway.capabilities` carry no version.
- `release_date` in `/api/status` is a hardcoded constant (`"2026.9.24"`, `hermes_cli/__init__.py` line 5) and does not track releases.

**Workaround.** Pin the Hermes version and do not auto-update. Generate client types from the contract at the pinned commit. Check `desktop_contract` and `version` at connect and fail clearly on a mismatch. Run the contract checks before each upgrade. The plugin API (hooks, dashboard routes) is part of what gets checked.

**Verdict: serious risk.** It is an ongoing maintenance cost, not a blocker.

## B9. `request.cancel` has no outcome

**Constraint.** When a request is answered on one client, the others get `request.cancel` with `{id, method, reason}` (`tui_gateway/server_requests.py` line 165). `reason` is `resolved` when another surface committed a choice and `session_closed` when the request was withdrawn without one (`tools/approval_gateway_wait.py` lines 206-219). The choice itself is not included.

**Workaround.** Infer the outcome from the following `tool.complete` (for example "BLOCKED: denied by user").

**Verdict: manageable.**

## B10. Remote access and auth

**Constraints.**

- A non-loopback bind requires login, and `--insecure` is ignored.
- The Host check rejects a MagicDNS name when the dashboard is bound to an IP. Declaring the name in `dashboard.public_url` lifts that (`hermes_cli/web_server_boundary.py` lines 29-42 and 98).
- CORS allows only localhost origins (`hermes_cli/web_server.py` lines 557-561). Requests from a webview fail. Requests from native code send no `Origin` and pass. A webview UI works when its networking runs in the native layer **(unverified by test)**.
- Basic auth has one username. Tokens are stateless HMAC, and `revoke_session` is a no-op (`plugins/dashboard_auth/basic/__init__.py` lines 125-167). Without a fixed secret, every restart logs everyone out.
- The native token exchange needs a `127.0.0.1` or `[::1]` redirect (`hermes_cli/dashboard_auth/routes.py` lines 262-275), so a phone cannot use a custom URL scheme.
- The WebSocket needs a single-use ticket, valid 30 s, from `POST /api/auth/ws-ticket` after cookie login.

**Consequences.** There are no per-device credentials. A lost phone can only be cut off by rotating the shared secret. The apps and the plugin share one account.

**Workaround.** Native networking, cookie login plus ticket, a fixed HMAC secret, and either the raw Tailscale IP or `dashboard.public_url`.

**Verdict: manageable** for a single-user setup.

## B11. Single network path and single host

**Constraint.** Everything goes over Tailscale (PC to devbox RTT 144 ms, direct path). Devbox has 6 vCPU and about 12 GB RAM. It runs two Hermes processes at roughly 500 MB RSS each, plus Caddy, the Honcho dashboard and other agents. If Tailscale or devbox is down, every bot, every routine and the default push channel are down.

**Verdict: manageable**, with one point of failure.

## B12. Testing needs a separate Hermes instance

**Constraint.** The phase-0 fake gateway was more lenient than real Hermes. The production instance must not be restarted or modified for tests. Tests on production also leave sessions, messages and agent turns behind.

**Safe test instance.** A second Hermes on another port with its own `HERMES_HOME`. That home must not share the production `installs/` or `tools/` folders. Hermes then treats it as a borrowing root and builds a separate dependency environment under it ("preparing dependencies for this data root"). If the test home links to the production `installs/`, Hermes treats it as the owner of the production install's dependency state, and a launch can start a dependency sync there.

Cost: about 400 MB of disk for the environment, about 500 MB RAM per running process, and a few minutes for the first start.

**Verdict: manageable.**

## B13. Windows platform (unverified)

- Windows toast notifications need a registered AppUserModelID or package identity to activate the app when clicked.
- Smart App Control or SmartScreen can block unsigned installers.

**Verdict:** unverified. Check before relying on Windows toasts.

## B14. Bot Chat runs in the gateway process

**Constraint.** Each profile's Bot Chat, the session that `deliver: bot-chat` posts into, belongs to the messaging gateway process. The client connects to the dashboard process on port 9119. A standalone dashboard runs the legacy path with no session authority, and the gateway's own API listens on `127.0.0.1` with a random port (`gateway/run_api.py` line 138). Its tickets come from the private control socket `gateway.sock`, for the same OS user only (`hermes_cli/gateway_client.py` lines 225-262).

**What a dashboard client gets for a Bot Chat** (live test, 2026-10-30):

- `prompt.submit` is refused locally ("Refusing legacy turn ... canonical ledger holds started work"). The dashboard then forwards it to the gateway's queue and returns `{"status": "queued", "forwarded": true}`. The reply runs after the current turn, in context.
- For the forwarded prompt, only `message.start`, `message.complete` and pending-list `session.info` are relayed (`tui_gateway/owner_forward.py`). The client gets no streaming text, no tool events, and no approval or clarify requests.
- `approval.respond` and `session.interrupt` sent to the dashboard cannot reach the gateway's turn. In the live test the gateway's approvals each timed out after 300 s while a dashboard client was attached.

**Workaround tested: a bridge.** A dashboard plugin bridges to the gateway. It runs inside the dashboard process as the same OS user, so it can connect with `hermes_cli.gateway_client.connect_gateway()`. It then declares `client.capabilities {server_requests: true}`, resumes the Bot Chat by stored id, and relays frames both ways. Tested on the test instance:

| Check | Result |
|---|---|
| Streaming text and tool start/complete | relayed |
| Approval | arrives as an `approval.request` event, answered with `approval.respond {session_id, prompt_id, execution_generation, choice}`, the command then ran |
| Clarifying question | arrives as a `clarify` server request when the prompt is submitted with `clarify_batch: true`, answered with `{answers: {qid: value}}` |
| Approval raised by a routine's follow-up turn | reached the bridge |
| Plugin routes without login | 401 |

**Chosen: avoid Bot Chat.** Bot Chat's routine delivery always starts a turn (B15). Each bot's chat is an ordinary dashboard session, and routines deliver into it through the plugin's delivery platform, so no bridge is needed.

**Verdict: avoided.**

## B15. Routine delivery into Bot Chat always starts a turn

**Constraint.** With `deliver: bot-chat`, the routine's output enters Bot Chat as an inbound message prefixed `[Cronjob "<name>" output — scheduled job, not the user. Review it, act on anything that needs action, and summarize for the chat.]`, and the bot runs a full turn on it (`cron/scheduler_delivery.py` lines 694-713). The message is admitted as internal automation (`gateway/session_bot.py` `_admit`), so it skips `pre_gateway_dispatch`, which runs only for messages from messaging platforms (`gateway/run_inbound.py`). `pre_llm_call` can add context but cannot cancel the call. On the test instance, a plugin asking `pre_gateway_dispatch` to skip routine messages did not stop the turn. No config setting turns the turn off.

**Workaround.** The plugin registers its own delivery platform, `hbapp`, with `ctx.register_platform(name, label, adapter_factory, check_fn, cron_deliver_env_var=...)` (`hermes_cli/plugins.py` line 787). Without `cron_deliver_env_var`, cron blocks the job with "delivery platform 'hbapp' is not a known cron delivery target" (`cron/scheduler_preflight.py`). A routine targets `hbapp:session-<stored session id>`. The adapter's `send()` receives the output and appends it to that chat. The tests below appended it with `gateway.mirror.mirror_to_session(..., role="user", session_id=...)`; the plugin writes an assistant-role row under the turn lease instead (B16, B20). Tested on the test instance:

| Check | Result |
|---|---|
| Routine created with one `POST /api/cron/jobs`, delivering into a chat created with `session.create` | output appended to the chat, no turn |
| Reply in the same open chat | the bot saw the output |
| The chat opened fresh on a second connection | the bot saw the output |
| Several runs into one chat | each appended in order |
| Asking the bot in a routine's chat to change its schedule (chat owned by the platform) | the bot edited the job with its cron tool |
| Model calls | one per routine run and one per user reply, none per delivery |
| Plugin installed with `plugins.manage`, then a gateway restart | platform connected with no `platforms:` config or env variables |

Delivery details confirmed by the plugin spike (2026-10-31):

| Check | Result |
|---|---|
| No `platforms:` config or env variables | The platform registers with `is_connected` returning true, and Hermes enables it in every profile that loads the plugin. The gateway logged `✓ hbapp connected` and `✓ hbapp connected (profile: spike2)` |
| Target with a routine key, `hbapp:session-<stored id>/<routine>` | `send()` receives `session-<stored id>/<routine>` unchanged, so the routine's identity travels in the target |
| Scheduled run (gateway, live adapter) | `send(chat_id, content, metadata={"job_id", "notify"})` |
| Run now (`POST /api/cron/jobs/{id}/trigger`) | Runs in the dashboard and delivers through `standalone_sender_fn` with no job id (B21) |
| Output over 4000 characters, scheduled run | Cut to 4000 with `... [truncated, full output saved to <path>]`; the footer is lost. With `splits_long_messages = True` on the adapter class, `send()` got all 5173 characters |
| Output over 4000 characters, Run now | Not cut (5177 characters) |
| `cron.wrap_response` true (default) | `Cronjob Response: <name>\n(job_id: <id>)\n-------------\n\n<output>\n\nTo stop or manage this job, send me a new message (e.g. "stop reminder <name>").` |
| `cron.wrap_response: false` | The bare output. Production runs with `false`. The setting is per profile |
| A failing run | Delivered on the same target as `⚠️ Cron '<name>' failed: <error> …`, wrapped like any other output. A repeat of the same failure is withheld for `cron.failure_repeat_alert_hours` (6 h by default) |
| Delivery into a stored id that does not exist | `append_message` fails with `FOREIGN KEY constraint failed`, and the job records the delivery error |
| A profile without the plugin | The job is created and Run now returns 200, but the run ends `delivery_failed` with "no delivery target resolved" |

Hermes's own mirror (`attach_to_session: true`, with `origin` set to the chat) also appends without a turn, but only into chats owned by the platform, and `POST /api/cron/jobs` ignores both fields, so each job needs a follow-up `PUT`.

**Verdict: manageable**, with the companion plugin.

## B16. Output written during a running reply is lost to the model

**Constraint.** Hermes rebuilds the model's view of a chat from the database with alternation repair (`hermes_state_messages.py` `_rows_to_conversation`, `repair_message_sequence`). On the test instance, a routine delivered while a reply was running a 75 s tool call. Its row was saved between the user's message and the reply's tool call. The repair dropped it from the model's view: the following replies, and a fresh resume on a second connection, counted 1 routine output of 2. The row still shows in the chat history. Hermes's own mirror writes the same way **(unverified)**.

Rows written between turns are fine. An open chat adds them to its history before the next turn (`tui_gateway/prompt_turn.py` `_adopt_out_of_band_turns`).

**Workaround.** Every turn holds the chat's cross-process turn lease (table `session_turn_leases`, `agent/turn_facade_lease.py`) while it runs. The plugin takes that lease itself and writes while holding it. The wait runs in a background worker, not inside the send, because Hermes cancels a Run now send after 60 s (B21):

1. resolve the stored id to the chat's current tip with `db.resolve_resume_session_id(id)` (compression can move it);
2. retry `db.try_acquire_session_turn_lease(id, holder, ttl_seconds=30)` every 2 s, for up to 15 minutes;
3. `db.append_message(id, "assistant", text, turn_lease_holder=holder)` (the role is explained in B20);
4. `db.release_session_turn_lease(id, holder)`.

A turn that starts in the meantime waits for the lease and then reloads the transcript, so no write can land mid-reply. Plugin spike, 2026-10-31: a routine delivered during a 60 s `sleep` tool call waited 78 s, 68 s and 66 s in three runs and was written about 1 s after the reply finished. The row sat after the finished reply, and both the open chat and a fresh connection quoted it. These are internal `SessionDB` methods, so the plugin tests cover them on every Hermes upgrade (B8). Polling for a finished last row also works, but it leaves a window of a few milliseconds after the user sends a message. The lease closes it.

**Verdict: manageable.**

## B17. Plugin WebSocket routes are not behind the login

**Constraint.** Plugin HTTP routes under `/api/plugins/<name>/` require the dashboard login, but plugin WebSocket routes do not. Hermes checks socket credentials for its own sockets (`/api/ws`, the PTY and audio streams) and for plugins served by a secondary profile (`hermes_cli/web_server_plugin_profiles.py` `refuse_secondary_plugin_socket`), not for plugins of the main profile. Tested on the test instance with a plugin exposing one HTTP route and one WebSocket route:

| Request | HTTP route | WebSocket route | WebSocket route with the plugin's own check |
|---|---|---|---|
| No credentials | 401 | accepted | 403 |
| Login cookie | 200 | accepted | 403 |
| Forged cookie | not tried | accepted | 403 |
| Ticket from `POST /api/auth/ws-ticket` | not tried | accepted | accepted |
| Login cookie with a foreign `Origin` | not tried | accepted | 403 |

**Workaround.** Before accepting, the plugin's WebSocket handler runs every check `/api/ws` runs, and closes the socket when one fails. It refuses every connection while the dashboard's chat is switched off (`hermes_cli.web_server._DASHBOARD_EMBEDDED_CHAT_ENABLED`), refuses the Desktop app's `X-Hermes-Gateway-Ticket` header, which `/api/ws` refuses, and runs `hermes_cli.web_server_chat._ws_auth_ok(ws)` for the credential and `_ws_request_is_allowed(ws)` for the Host and Origin headers. Clients connect with a fresh single-use ticket, the same way they open `/api/ws`. Both functions are private, so the plugin tests cover them on every Hermes upgrade (B8).

Plugin spike, 2026-10-31, alerts route on the Tailscale bind:

| Request | `_ws_auth_ok` only | Both checks | `/api/ws` |
|---|---|---|---|
| No credentials, cookie only, forged cookie | refused | refused | refused |
| Ticket in `?ticket=` | accepted | accepted | accepted |
| Ticket in the subprotocol pair `hermes-gateway-v1` + `hermes-gateway-ticket.<ticket>` | accepted | accepted | not tried |
| Ticket used a second time | refused | refused | not tried |
| Ticket with `Origin: https://evil.example` | **accepted** | refused | refused |

- A refusal before `accept()` reaches the client as an HTTP 403 handshake failure, not a 1008 close frame.
- Hermes mounts a newly installed plugin's WebSocket routes only after a dashboard restart or after the first HTTP request to one of the plugin's routes (`web_server_dashboard.py`, the hot-mount fallback covers HTTP only). Before that the socket got 403. The app therefore calls the plugin's `GET /info` before it opens the alerts socket.

**Verdict: manageable.**

## B18. Plugins are per profile

**Constraint.** Hermes looks for user plugins only in the active profile's home, `<home>/plugins` (`hermes_cli/plugins_discovery.py`), and enables them per profile in `plugins.enabled`. A profile without the plugin has no `hbapp` platform, so its routines fail at delivery (B15). Each bot is a profile, so each bot needs the plugin.

`plugins.manage` takes a `profile` parameter. The spike installed the plugin into `default` and `spike2` with one call each, and each profile got its own copy (`<root>/plugins/hermes-bots`, `<root>/profiles/spike2/plugins/hermes-bots`). One gateway served both profiles and connected `hbapp` in each.

The dashboard runs a secondary profile's dashboard plugin code in a separate plugin-host process (`hermes_cli/web_server_plugin_profiles.py`). Its HTTP routes work with `?profile=<name>`. Its WebSocket routes are refused: the spike's alerts socket with `?profile=spike2` got HTTP 501. Only the launch profile's install, the default profile on devbox, can serve the alerts socket.

Each profile's plugin writes alerts to one SQLite file at the root, `<root>/plugin-data/hermes-bots/` (`hermes_constants.get_default_hermes_root()`), not to the per-profile `plugin-data` directory. The launch profile's socket then streams alerts for every bot. In the spike, alerts written by the gateway and by the dashboard reached the socket within its 0.5 s poll.

Hermes main after v0.22.5 (source at `c419cf7c86`, 2026-10-31, not run) keeps plugins per profile. PRs #144595 and #143590, merged 2026-10-25, are in the canary builds from 2026-10-26 and in no stable release:

- #144595 (MSG-44) lets a secondary profile whose only adapter is `LOCAL` borrow the primary profile's bot for cron delivery. It applies only under `gateway.multiplex_profiles`, and only to a target that a `gateway.profile_routes` entry maps to that profile with an exact `chat_id` (`SharedRouteAdapters` in `cron/scheduler_preflight.py`). It lends live adapters to a profile and registers no plugin platform there.
- #143590 admits background wake-ups by route identity instead of display fields. It does not touch plugins or cron delivery.
- Plugin discovery still reads `<active home>/plugins`. The platform registry keeps plugin platforms per Hermes home (`_scoped_entries` in `gateway/platform_registry.py`), and hooks go to the active home's plugin manager (`_delivery_manager` in `hermes_cli/plugins.py`). In a profile without the plugin, an `hbapp:` target fails to resolve before any adapter is borrowed (`resolve_send_target`, "no delivery target resolved"), and that bot's turns fire none of the plugin's hooks.

**Workaround.** The app installs the plugin into every profile and checks each one at connect. A bot created later gets the plugin when the app next connects.

**Verdict: manageable.**

## B19. Plugin updates and versions

**Constraints** (plugin spike, 2026-10-31):

- `plugins.list` reports `"version": "?"` for every plugin. `plugins.manage {action: "list", profile}` returns the `plugin.yaml` version and `pinned_sha`. Both read the files on disk, not the code that is running.
- `ref` must be a full 40-character commit SHA (`hermes_cli/plugins_cmd_git.py`). A ref-pinned install reports `update_available: null`, and `plugins.manage {action: "update"}` refuses it with error 4021. A plain reinstall fails with 5026 ("already exists"). The way to move a pinned install is `install` with `force: true` and the new `ref`.
- Install returns two warnings for a source outside the Hermes catalog ("Custom (unreviewed) source", and "Insecure URL scheme" for `file://`).
- A first install with no gateway running returned `restart_required: true`. A forced reinstall with the gateway running returned `restart_required: false, gateway_reloaded: true`. Both processes re-registered the plugin, so hooks and `standalone_sender_fn` ran the new code. The gateway kept its existing `hbapp` adapter object, which still ran the old code: a scheduled run went through it and failed. The running dashboard kept serving the old dashboard routes.
- Hermes has no API to restart the dashboard. `POST /api/gateway/restart` restarts only the gateway. A mounted dashboard plugin is never reloaded.

**Workaround.**

- The plugin's `GET /api/plugins/hermes-bots/info` returns the version of the code the dashboard is running. `plugins.manage list` per profile returns the version on disk.
- After an install or update, the app restarts the gateway with `POST /api/gateway/restart`. When `/info` still reports an older version than the disk, the plugin update screen asks the user to restart the dashboard and shows the exact steps. The restart is manual for now; a later release automates it.
- Keep the plugin's dashboard code small and stable: the alerts socket, the auth checks and `/info`. Most changes then need only the gateway restart.

**Verdict: manageable.**

## B20. A user-role routine row merges with the user's next message

**Constraint.** Model APIs require user and assistant messages to alternate. Before each model call Hermes merges consecutive rows with the same role into one message, joined with a blank line (`repair_message_sequence` in `agent/agent_runtime_helpers.py`). The rows stay separate in the database. A routine written as a user-role row therefore reaches the model as one message together with the user's next message, and the user's words read as the tail of the routine output.

Plugin spike, 2026-10-31: in a chat whose last rows were user-role routine outputs, the user asked to run `rm -rf /tmp/hb-spike-dir-xyz`. The bot refused and called the request a likely prompt injection "appended to" cron output. The same setup in three fresh chats got a normal approval request each time, so the refusal is not reliable, but the merge is.

**Workaround.** The plugin writes routine output as an assistant-role row, the bot's own message:

```
[Routine: <name>]
<output>
```

The routine is the bot's own output from a scheduled run, so the role matches what happened. The user's next message then follows a bot message and is never merged with it. A routine that directly follows a bot reply is merged into that reply for the model, which keeps the user's words apart.

Plugin spike, 2026-10-31, assistant-role rows written through Run now into `spike2` chats:

| Check | Result |
|---|---|
| Two routines after a reply, then the `rm -rf` request (three fresh chats) | Normal approval request in all three |
| The same open connection asked to quote the routine | Quoted it exactly and named it automated cron output, not the user's or the bot's |
| A fresh connection resumed the chat and asked about it without tools | Answered from the routine and named it cron output |

No extra turn is involved. The plugin writes the row directly, with no model call.

**Verdict: manageable.**

## B21. Where routines run

**Constraints** (source and plugin spike, 2026-10-31):

- **Scheduled runs need the gateway.** A plain `hermes dashboard` does not tick cron. Only the desktop backend (`hermes serve`) starts the dashboard's own ticker (`hermes_cli/web_server_app.py`). With the test gateway stopped, a job due every minute did not run for over 4 minutes, then ran when the gateway came back.
- **Run now runs in the dashboard.** `POST /api/cron/jobs/{id}/trigger` runs the job in the dashboard process and delivers through the platform's `standalone_sender_fn`, with no metadata.
- **Run now blocks until delivery ends, for up to 60 s.** The HTTP request returns only after `standalone_sender_fn` returns. Hermes cancels a standalone send after `cron.standalone_send_timeout_seconds` (60 s by default) and records the run as `delivery_failed` with "timed out after 60s (the send may still be in flight)" (`_standalone_send` in `cron/scheduler_delivery.py`). The spike's three B16 runs went through Run now and were all recorded this way, although each row landed: the spike adapter waited in a blocking loop that the cancellation could not stop.
- **A scheduled send is not cut off.** The gateway waits 60 s for the live adapter's `send()`, then logs it as in flight, records the delivery as done and lets the send finish.
- The gateway runs each job in a restart-safe worker process, which also loads the plugin. The worker hands the output back to the gateway, and the gateway's live adapter delivers it.

**Workaround.** Register both `send()` and `standalone_sender_fn`, sharing one delivery function. That function does not wait for a running reply itself. It queues the routine row in the plugin's store and returns at once, and a background worker in the same process takes the turn lease and writes it (B16). Rows still queued when the process stops are written by the next process that loads the plugin. The app shows the result of Run now when the routine message arrives.

**Verdict: manageable.**

---

## Build 39 push evidence

What the logs show about the missing push in build 39. They were read only; topic names are omitted.

- **Notifier.** `notifier.log` shows the PR #14 deploy at 2026-10-28 23:44:27 IST. It logged in and emitted 11 NOTIFY events for one session (6 "approval waiting", 5 "reply finished"), with no "notify post failed" lines.
- **ntfy server.** `messages_published` rose from 12 to 23 between 01:29 and 01:34 IST on 2026-10-29, with 4 subscribers and 4 active topics.
- **ntfy cache.** 17 messages on one UnifiedPush topic: 6 on 2026-10-28 and 11 on 2026-10-29 between 01:29:38 and 01:33:42 IST.
- **Process state.** The ntfy server was stopped at 2026-10-29 01:38:27 IST.

The notifier to ntfy leg worked. The loss happened between the self-hosted ntfy and the phone. Likely causes: a stale UnifiedPush registration (the same topic was reused across reinstalls), the phone being off the tailnet, or Android killing the ntfy connection. This is the failure B2 describes. The foreground-service device test removes the last two causes with an always-on VPN and battery exemptions, and the ntfy.sh device test does not depend on any of them.

## Is it feasible as specified?

**Yes**, with stock Hermes v0.22.5 and these conditions:

1. A companion Hermes plugin, installed in every bot's profile, provides the routine delivery platform (B15, B16, B20, B21) and the push hooks (B1, B18). Bot Chat is not used (B14).
2. Android push uses the app's own foreground service over Tailscale, with battery exemption and always-on VPN; ntfy is an optional alternative (B2).
3. Hermes is pinned, and every upgrade passes the contract and plugin checks (B8).
4. Clients use native networking, resume by stored id, and treat a new replay epoch as a reset (B6, B7, B10).
5. Development runs against a separate test instance (B12).
6. `approvals.timeout` is raised to suit phone response times (B5), and each bot's profile sets `approvals.mode: manual` (B1).
7. The gateway runs at all times; it alone ticks scheduled routines (B21).

Open items:

- Windows toast activation and installer signing (B13).
- How outbound webhooks behave in the standalone dashboard (B1).
- Long-term foreground-service delivery and other phone makers (B2).
- The gateway restart after installing the plugin relies on a supervisor to start the gateway again. Setups without one are unverified.
- Messages between bots outside Bot Chat (`message_agent` is available only there).
- Restarting the dashboard after a plugin update is a manual user step; automating it is still to be designed, since Hermes has no API for it (B19).

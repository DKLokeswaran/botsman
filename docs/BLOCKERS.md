# Hermes Bots: feasibility blockers

This document lists the constraints that decide whether Hermes Bots can be built as specified. They come from Hermes Agent itself, from the platforms (Android, Windows, push delivery), from the network and hosting setup, and from the architecture. UI bugs, app bugs and process issues are out of scope.

Hermes Bots is a custom Windows and Android client for a self-hosted Hermes Agent **v0.22.5**. It needs:

- per-profile bots, each with one main chat (Bot Chat) and side chats
- routines (cron) that post into the bot's main chat, with replies in context
- streaming replies and live tool activity
- inline approvals and clarifying questions
- session history, synced across devices
- push notifications when the apps are closed

The architecture that answers these constraints is in [ARCHITECTURE.md](ARCHITECTURE.md).

## Evidence base

- **Hermes source.** `hermes-agent` at commit `bf0203a794` (tag v0.22.5, 2026-10-23), the tree the devbox instance runs. File references below are paths in that tree.
- **Live tests on devbox, 2026-10-30.** One routine delivered into the main profile's Bot Chat, a reply sent from a dashboard client, and the logs of both Hermes processes.
- **Test-instance runs, 2026-10-30.** A throwaway Hermes on port 9129 with its own `HERMES_HOME`, its own gateway, no messaging platforms, and a test plugin.
- **Device tests, 2026-10-30.** Messages to an Android phone with the app in the background: three through ntfy.sh, and three through a foreground-service connection to the devbox over Tailscale.
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
| B14 | Bot Chat runs in the gateway process, out of the dashboard's reach | Hermes architecture | No (plugin) | Manageable |

**Bottom line.** Hermes Bots is feasible as specified with stock Hermes v0.22.5 and a companion Hermes plugin, with push through the app's own foreground service. B8 is the one serious risk left, and it is handled by pinning the Hermes version. Details are at the end.

---

## B1. Hermes has no device push channel

**Constraint.** Hermes v0.22.5 has no APNs, FCM, Web Push or UnifiedPush integration. `notification.show` is a toast sent down an open WebSocket, so with no client connected Hermes tells nobody.

**Workaround.** A Hermes plugin registers lifecycle hooks and sends the push itself. The hooks that matter:

- `pre_approval_request` and `post_approval_response`
- `on_human_input_request` and `on_human_input_resolved` (approvals and clarifying questions)
- `post_llm_call` and `on_session_end` (turn finished)

The hooks fire in whichever Hermes process runs the turn. The test instance confirmed this for the dashboard process, for an ordinary gateway session, and for the gateway's Bot Chat. A test plugin POSTed every hook event to an HTTP endpoint, and every POST arrived. No polling and no separate watcher service are needed.

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

**Workaround.** The plugin hooks in B1 are the global signal for notifications. Answering a request still needs a connection that owns the session: the dashboard socket for dashboard sessions, and the bridge in B14 for Bot Chat.

**Verdict: manageable.**

## B4. A routine's own run can never ask for approval

**Constraint.** The cron run uses `approvals.cron_mode`, a binary deny/approve setting that defaults to deny (`tools/approval_context.py` lines 346-359). Webhook and API-server platforms use `approvals.unattended_mode` in the same way (lines 175-190 and 366-371).

**What still works.** With `deliver: bot-chat`, the routine's output enters the profile's Bot Chat as a normal turn (`cron/scheduler_delivery.py` lines 694-713). That follow-up turn is interactive. It runs in the gateway with platform `cli`, outside both cron mode and unattended mode, and it raises real approvals. On the test instance, a routine's follow-up turn raised an approval and the request reached a client through the bridge (B14).

So "a routine wants to do something risky, and I approve it from my phone" works when the risky step happens in the Bot Chat follow-up turn.

Two side effects:

- Hermes's cron injection scanner flags destructive commands written into a job prompt (observed: `destructive_root_rm`).
- The bot treats routine output as something to act on. A vague routine output can send it off investigating with tools, so routine prompts need to be specific.

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

**Workaround.** A dashboard plugin bridges to the gateway. It runs inside the dashboard process as the same OS user, so it can connect with `hermes_cli.gateway_client.connect_gateway()`. It then declares `client.capabilities {server_requests: true}`, resumes the Bot Chat by stored id, and relays frames both ways. Tested on the test instance:

| Check | Result |
|---|---|
| Streaming text and tool start/complete | relayed |
| Approval | arrives as an `approval.request` event, answered with `approval.respond {session_id, prompt_id, execution_generation, choice}`, the command then ran |
| Clarifying question | arrives as a `clarify` server request when the prompt is submitted with `clarify_batch: true`, answered with `{answers: {qid: value}}` |
| Approval raised by a routine's follow-up turn | reached the bridge |
| Plugin routes without login | 401 |

**Verdict: manageable**, with a companion plugin and no Hermes code change.

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

1. A companion Hermes plugin provides the Bot Chat bridge (B14) and the push hooks (B1).
2. Android push uses the app's own foreground service over Tailscale, with battery exemption and always-on VPN; ntfy is an optional alternative (B2).
3. Hermes is pinned, and every upgrade passes the contract and plugin checks (B8).
4. Clients use native networking, resume by stored id, and treat a new replay epoch as a reset (B6, B7, B10).
5. Development runs against a separate test instance (B12).
6. `approvals.timeout` is raised to suit phone response times (B5).

Open items:

- Windows toast activation and installer signing (B13).
- How outbound webhooks behave in the standalone dashboard (B1).
- Long-term foreground-service delivery and other phone makers (B2).
- Installing plugins from the app. `plugins.manage` supports it, but it has not been tested (see ARCHITECTURE.md).
- A production design for the bridge transport. The test used HTTP long-polling. Whether WebSocket routes in plugins sit behind the dashboard login is unverified.

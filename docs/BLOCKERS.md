# Hermes Bots: feasibility blockers

This document lists the **fundamental constraints** that could make Hermes Bots impossible or not viable as specified. These are limits in Hermes Agent itself, in the platforms (Android, Windows, push delivery), in the network and hosting setup, and in the architecture.

It deliberately leaves out UI/UX bugs, app bugs and process issues.

**What Hermes Bots is meant to be:** a custom Windows and Android client for self-hosted Hermes Agent **v0.22.5**. The required features are:

- per-profile bots
- streaming replies
- live tool activity
- inline approvals and clarify questions
- routines (cron)
- session history
- push notifications to the phone when the apps are closed

**Evidence base:**

- **Hermes source:** `hermes-agent` at commit `bf0203a794` (v0.22.5 line, committed 2026-10-22). This is the tree the running instance on devbox uses.
- **Live measurements:** taken from devbox on 2026-10-30 (IST).
- **Repo docs:** `docs/research/REPORT.md`, `docs/research/LATER-FINDINGS.md`, and the closed phase-0 branch `cursor/phase0-integration:docs/regressions.md`.
- **Push logs:** the notifier and ntfy logs and the ntfy message cache for build 39. These were read only. Topic names and credentials are not reproduced here.

Items not verified against source or a measurement are marked **(suspected)**.

---

## Summary

| # | Constraint | Area | Needs Hermes change? | Verdict |
|---|---|---|---|---|
| B1 | Hermes has no push channel of any kind | Hermes | No (external watcher) | **Serious risk** |
| B2 | Closed-app delivery to Android depends on a self-hosted ntfy socket over Tailscale (no FCM) | Platform / network | No | **Serious risk**; a hard blocker for "reliable push" unless the delivery path changes |
| B3 | No global "approval pending" signal; a watcher must poll and attach to every session | Hermes architecture | No (polling); a clean fix needs one | **Serious risk** |
| B4 | Routines (cron) can never ask for approval | Hermes | **Yes** | **Hard blocker** for phone approval of routine actions |
| B5 | Approvals time out and fail closed (default 300 s) | Hermes | No (config) | **Manageable** |
| B6 | Session identity is ephemeral (runtime ids reaped 20 s after the last client; lost on restart) | Hermes architecture | No | **Manageable** |
| B7 | Live-event replay is bounded and does not survive restarts | Hermes | No | **Manageable** |
| B8 | Unversioned, fast-moving gateway protocol | Hermes | No (pinning) | **Serious risk** |
| B9 | `request.cancel` does not say how an approval was resolved | Hermes protocol | No (inference); a clean fix needs one | **Manageable** |
| B10 | Remote access: login required, Host/Origin/CORS locked to loopback/IP, single user, weak session model | Hermes / network | No | **Manageable** |
| B11 | Everything depends on Tailscale and one shared devbox | Network / hosting | No | **Manageable**, but it is a single point of failure |
| B12 | No safe way to test against a real gateway | Architecture | No | **Serious risk** |
| B13 | Windows notification activation and unsigned installer | Platform | No | **(suspected)**, not verified |

**Bottom line (details at the end):** the project is **feasible for everything that happens while an app is open**. It is **not feasible as specified** in two places:

- **Approving routine actions from the phone.** This needs a Hermes change (B4).
- **"Reliable push when the apps are closed".** This works only if an always-on external watcher is added, and only if push delivery is either moved onto FCM (ntfy upstream relay) or hardened on the phone with an exemption from Android battery optimisation and an always-on Tailscale VPN (B1–B3).

---

## B1. Hermes has no push channel

**Constraint.** Hermes v0.22.5 has no APNs, FCM, Web Push or UnifiedPush integration.

- `notification.show` is a toast sent down an *open* WebSocket.
- If no client is connected, nothing is sent anywhere.

**Evidence.**

- `docs/research/REPORT.md`, push section: no push providers exist in the tree, and `notification.show` is socket-only.
- The OpenAI-compatible API on port 8642 has no `/api/ws` and no clarify flow, so it is not an alternative channel.

**What it breaks.** The feature "notify my phone when a bot needs approval or finishes, while the apps are closed" cannot come from Hermes. Once the app is closed, Hermes has nobody to tell.

**Workaround and cost.**

- Run a separate always-on **watcher** process next to Hermes. It holds its own gateway connection and forwards events to a push service. This is what `hermes-notifier` does.
- Cost: a second long-lived service to deploy, monitor and authenticate.
- It inherits B3 (no global signal) and B6 (session lifetime).
- It must log in as the single Hermes user (B10). It has already hit login rate limits (HTTP 429 with Retry-After) and `4007` resume loops in `notifier.log`.
- No Hermes modification is needed.

**Verdict: serious risk.** It is buildable, but the "push" feature is really a separate product with its own reliability problem.

---

## B2. Closed-app delivery to Android has no FCM path

**Constraint.** The ntfy server on devbox (ntfy 2.34.0) is configured as follows:

- It listens only on the Tailscale IP.
- Its base URL is the MagicDNS name.
- Its default access is deny-all.
- It has **no `upstream-base-url` and no Firebase key.**

ntfy's own documentation says the Android app uses Firebase only for `ntfy.sh`, and never for self-hosted servers ([docs.ntfy.sh/subscribe/phone](https://docs.ntfy.sh/subscribe/phone/#instant-delivery)). Every message therefore depends on two things staying alive on the phone:

- the ntfy app's own long-lived connection (the "instant delivery" foreground service), and
- the Tailscale VPN, because the server is reachable only inside the tailnet.

**Evidence (measured).**

- `tailscale status` on devbox at 03:11 IST on 2026-10-30 showed the phone (`android`) as **"offline, last seen 31m ago"**.
- `tailscale ping` to the phone timed out.
- The Windows PC was reachable at 144 ms.
- While the phone is in that state, a server that is only reachable over the tailnet cannot reach it at all.
- Build 39 (see "Build 39 push evidence" below): the server accepted and cached every notification, and the phone showed none.

**What it breaks.** Push notifications when the apps are closed: the core reason for having a phone app.

- Android Doze, OEM battery managers and the Tailscale VPN being dropped all silently stop delivery.
- Messages arrive late (when the connection comes back) or never show at all if the UnifiedPush registration is stale.

**Workarounds and cost.**

1. **Set `upstream-base-url: https://ntfy.sh` on the self-hosted ntfy.**
   - This lets ntfy.sh poke the phone through FCM, and the app then fetches the message from devbox.
   - Cost: a third-party relay (ntfy.sh plus Google) sees the topic hash and when messages are sent, though not their content.
   - The phone still needs Tailscale to fetch the content when woken, unless the server is exposed publicly.
   - No Hermes change.
2. **Expose ntfy publicly** (Tailscale Funnel or a reverse proxy with TLS).
   - This removes the Tailscale dependency on the phone.
   - Cost: a public attack surface. Auth stays deny-all.
3. **Keep the current design but harden the phone.**
   - Exempt both ntfy and Tailscale from battery optimisation, and turn on Tailscale "Always-on VPN".
   - Cost: the setup is per device and fragile across OEM updates, and it is still not guaranteed.
4. **Ship our own FCM integration** in the Android app plus a sender.
   - Cost: a Firebase project and Google Play Services dependency, and a server key on devbox.

**Verdict: serious risk, and a hard blocker for "reliable push when closed" with the current self-hosted, Tailscale-only, no-FCM setup.** It becomes manageable if option 1 or 2 is accepted.

---

## B3. No global "approval pending" signal

**Constraint.** Approval and clarify requests (`server_requests`) are sent only on the **owning session's** transport, not to every client.

- Source: `tui_gateway/server.py` `write_json` routes by `params.session_id`, lines 697–714.
- The global broadcast helper `_broadcast_global_event` (server.py:762) covers only:
  - skin and display events
  - connection and onboarding events
  - `session.reclaimed`
  - `approval.cancelled`
  - the change-watcher events
- `sessions.changed` has an **empty payload**. It is polled every 0.5 s and broadcast at most once per 2 s (`tui_gateway/change_watcher.py` around lines 375–425).
- The only way to find a pending approval is to poll `session.active_list`, where the status becomes `"waiting"` (`tui_gateway/session_registry.py` around line 650), and then `session.activate` each live session to receive the pending request. The notifier does exactly this every 5 s.

**What it breaks.**

- The watcher, and any second device, cannot learn about approvals cheaply or instantly.
- A short turn can start and finish between two polls, so its "reply finished" notification is missed.
- Every poll costs a gateway round-trip per session.
- A watcher that attaches to a session also **keeps it alive**: the orphan reap (B6) never fires while it is attached. That changes Hermes's lifetime behaviour for every session.

**Workaround and cost.**

- Polling: 5 s latency, missed short turns, extra load. No Hermes change.
- A clean fix is a global `approval.requested` event or a subscribe-all option. That is a **Hermes modification** and needs approval.

**Verdict: serious risk.** It works today with polling, but it is lossy by design.

---

## B4. Routines (cron) can never ask for approval

**Constraint.** Approval prompts are only raised when someone can answer interactively.

- Cron sessions use `approvals.cron_mode`. This is a **binary deny/approve** setting with default deny: `tools/approval_context.py` around line 359 (`_binary_approval_mode("cron_mode")`).
- Unattended platforms (`webhook`, `msgraph_webhook`, `api_server`) use `approvals.unattended_mode` in the same way (approval_context.py lines 173–245 and 366–371).

**What it breaks.** "A routine runs at 7:00, wants to run a guarded command, and my phone shows Approve / Deny" is **impossible** without changing Hermes. A routine either:

- denies every guarded action, or
- is pre-approved for every guarded action.

There is no per-action human approval.

**Workaround and cost.**

- Run routines from our own scheduler as normal interactive sessions, so approvals go through B1–B3.
  - Cost: we lose Hermes's own cron (its jobs, history and UI), and the session must stay attached (B6).
- Add an "ask" cron mode to Hermes. This is a **Hermes modification** and needs approval.
- Accept binary per-routine policy (deny or approve) and only *notify* the outcome.

**Verdict: hard blocker** for phone approval of routine actions as specified. The rest of the routines feature (list, run, history, notify on finish) is unaffected.

---

## B5. Approvals time out and fail closed

**Constraint.** `approvals.timeout` defaults to **300 s**. After that the request is denied (approval_context.py lines 305–323).

**What it breaks.** An approval that reaches the phone late (B2) or is noticed late is already denied, and the turn moves on or fails.

**Workaround and cost.** Raise `approvals.timeout` in Hermes config. No code change.

- Cost: a turn that is waiting blocks its session for that long.

**Verdict: manageable.**

---

## B6. Session identity is ephemeral

**Constraint.** Each session has two ids:

- a **runtime id** (8 hex characters) used by `session.activate`
- a **stored id** used by `session.resume`

Using the wrong id gives `4007` (resume with a runtime id) or `4001` (activate an unknown id).

- A WebSocket session with no attached client is reaped after `HERMES_TUI_WS_ORPHAN_REAP_GRACE_S`, default **20 s** (server.py lines 139–146).
- A Hermes restart drops all runtime ids.

**What it breaks.** After the app is closed or Hermes restarts, saved runtime ids are useless. Clients must store and resume by stored id. The notifier's `4007` loops in `notifier.log` are this.

**Workaround and cost.**

- Persist stored ids.
- Always resume by stored id, and re-map to the runtime id the server returns.
- No Hermes change.

**Verdict: manageable.**

---

## B7. Bounded replay, none across restarts

**Constraint.** The replay ring (`tui_gateway/event_replay.py` lines 28–36) holds:

- 512 events and 4 MB per session
- at most 64 sessions
- about 64 MB per process

`replay_epoch` changes on every restart.

**What it breaks.** A client that reconnects after a long turn, or after a restart, cannot replay what it missed. It must refetch the transcript, so live tool-activity detail can be lost.

**Workaround and cost.** Detect a truncated replay or a new epoch, then refetch history. No Hermes change.

**Verdict: manageable.**

---

## B8. Unversioned, fast-moving protocol

**Constraint.**

- The gateway contract (`apps/shared/src/gateway-contract.openrpc.json`) is generated in-tree. It reports `info.version: "1"`, has 258 methods and has **no deprecation flags**.
- `gateway.ready` carries no protocol version (`tui_gateway/ws.py` around lines 545–553).
- If `session_authority` is set, legacy session-writer methods are refused.

**Evidence (measured on the Hermes git history):**

- **Release frequency:** 8 stable releases between 2026-10-08 and 2026-10-23 (v0.21.6 → v0.22.5), with several rc and canary tags each.
- **Commit volume:** about 15,200 commits in the last 30 days, 784 touching `tui_gateway/` and 206 touching the contract file.
- **Contract diff per release:**

  | From → to | Methods added | Methods removed | Changed |
  |---|---|---|---|
  | v0.21.6 → v0.22.0 | 6 | 6 | 1 |
  | v0.22.0 → v0.22.4 | 0 | 0 | 1 (+3 events) |
  | v0.22.4 → v0.22.5 | 1 | 0 | 1 |

  The six removed in v0.22.0 include `session.start_chat` and the `onboarding.*` setup calls. They were removed with no deprecation period.

- **Updates:** `/api/status` on the running instance reports `can_update_hermes: true`.

**What it breaks.** Any Hermes update can silently break the client.

- Methods can disappear without warning.
- The client cannot detect what version it is talking to, so it cannot fail clearly.

**Workaround and cost.**

- Pin the Hermes version and do not auto-update.
- Generate client types from the contract at the pinned commit.
- Run contract checks before each upgrade.
- Cost: an ongoing maintenance tax, and a lag behind Hermes fixes.
- No Hermes change.

**Verdict: serious risk.**

---

## B9. `request.cancel` has no outcome

**Constraint.** When an approval is answered on one device, the other devices receive `request.cancel` with `reason: "resolved"` and no choice. Source: `cursor/phase0-integration:docs/regressions.md`.

**What it breaks.** Other devices cannot show "approved" or "denied". They have to infer it from the later `tool.complete` text ("BLOCKED: denied by user").

**Workaround and cost.** Infer the outcome from `tool.complete`. A clean fix is a **Hermes change**.

**Verdict: manageable.**

---

## B10. Remote access and auth model

**Constraints** (from `docs/research/REPORT.md` and `hermes_cli/web_server.py`, re-checked live):

- **Login is mandatory.** A non-loopback bind requires login, and `--insecure` is ignored.
- **Host header check (web_server.py around lines 369–387).** A request with the MagicDNS Host header gets **HTTP 400**. This was measured live on 2026-10-30 against `100.113.35.96:9119`. Clients must use the raw Tailscale IP.
- **CORS (web_server.py around lines 549–562).** Only localhost origins are allowed, and the WebSocket Origin check is strict. Browser or webview clients are effectively ruled out; clients must use native networking.
- **Session model:**
  - Basic auth uses stateless HMAC tokens.
  - If the secret is unset, all sessions die on restart.
  - Revoke is a no-op.
  - There is only **one username**.
- **Native token exchange** needs a `127.0.0.1` redirect, so a phone cannot use a custom URL scheme.
- **The WebSocket needs a 30 s single-use ws-ticket** obtained after cookie login.

**What it breaks.**

- There are no per-device credentials and no way to revoke a lost phone except by rotating the shared secret.
- The apps, the notifier and every device share one account.
- Apps must hard-code the IP.

**Workaround and cost.**

- Use a native HTTP/WebSocket stack, the IP-based base URL, and cookie plus ticket login.
- Set a fixed HMAC secret so restarts don't log everyone out.
- No Hermes change.
- Per-device auth would need a Hermes change.

**Verdict: manageable** for a single-user personal setup.

---

## B11. Single network path and single host

**Constraint.**

- **Network:** everything goes over Tailscale (measured PC↔devbox RTT 144 ms, direct path).
- **Host:** devbox is one machine with 6 vCPU and about 12 GB RAM. It runs:
  - two Hermes processes, about 500 MB RSS each
  - Caddy
  - the Honcho dashboard
  - other agents

**What it breaks.** If Tailscale or devbox is down, every bot, routine and notification is down. The phone dropping off the tailnet (B2) also cuts in-app use.

**Workaround and cost.** Accept it as a personal-scale design, or add monitoring and a public ingress. No Hermes change.

**Verdict: manageable**, but it is a single point of failure.

---

## B12. No safe real-gateway test bed

**Constraint.**

- The phase-0 fake gateway is more lenient than real Hermes.
- The real gateway has these behaviours:
  - id rules (B6)
  - routing of approvals to the owning session only (B3)
  - the login rate limits (HTTP 429)
  - Host/Origin checks (B10)
- The only real instance is the user's production Hermes, and it must not be restarted or modified.

**What it breaks.** Features "pass" against the fake and then fail against real Hermes. Phase 0 history shows exactly this.

**Workaround and cost.** Run a second, pinned Hermes instance on another port, bound to `100.113.35.96`, with a throwaway home directory, to use as the test target.

- Cost: about 500 MB RAM on devbox, setup time, and the user's approval to run it.
- No Hermes change.

**Verdict: serious risk** until a real test instance exists.

---

## B13. Windows platform (suspected)

**(Suspected, not verified this round.)**

- Windows toast notifications need a registered AppUserModelID or package identity to activate the app when clicked.
- Unsigned installers can be blocked by Smart App Control or SmartScreen.

Either could affect the Windows client's notifications and installation.

**Verdict:** suspected; verify before relying on Windows toasts.

---

## Build 39 push evidence

What the logs show about the missing push in build 39. They were read only, and topic names are hashed or omitted.

- **The notifier.** `notifier.log` shows the PR #14 deploy at 2026-10-28 23:44:27 IST.
  - It logged in successfully.
  - It then emitted **11 NOTIFY events** for one session: 6 "approval waiting" and 5 "reply finished".
  - There are **0 "notify post failed"** lines.
- **The ntfy server.** `ntfy.log` shows `messages_published` rising from 12 to 23 between 01:29 and 01:34 IST on 2026-10-29, with 4 subscribers and 4 active topics.
- **The ntfy cache.** The ntfy message cache holds 17 messages, all on **one UnifiedPush topic**:
  - 6 on 2026-10-28
  - **11 on 2026-10-29 between 01:29:38 and 01:33:42 IST**, all default priority, alternating approval and reply
- **Process state.** The ntfy server was stopped at 2026-10-29 01:38:27 IST. Neither ntfy nor the notifier is running now.

**Conclusion:** the notifier → ntfy leg worked, because every build-39 notification was accepted and stored. The loss happened **between ntfy and the phone**.

- The logs, at INFO level, cannot show whether the phone was one of the 4 subscribers.
- **Suspected causes:**
  - a stale UnifiedPush registration. The same topic was reused across app reinstalls and builds.
  - the phone being off the tailnet. It was observed offline on 2026-10-30.
  - Doze or battery optimisation killing the ntfy connection.

This is B2 in practice.

---

## Bottom line: is it feasible as specified?

**Feasible**, with no Hermes changes, for all **in-app** features while an app is open and connected:

- per-profile bots
- streaming
- live tool activity
- inline approvals and clarify
- session history
- routine management

This is true only under these conditions:

- Hermes is version-pinned and the contract is checked on every upgrade (B8).
- Clients use native networking with the raw Tailscale IP and resume by stored id (B6, B10).
- A real pinned Hermes test instance is available (B12).

**Not feasible as specified** in two places:

1. **Phone approval of routine actions** (B4). This needs either a Hermes modification (an "ask" cron mode, which needs the user's approval) or replacing Hermes cron with our own scheduler driving interactive sessions.
2. **Reliable push when the apps are closed** (B1–B3). The current setup cannot do this: Hermes has no push channel, and the notifier is lossy and depends on polling. On top of that, delivery goes through self-hosted ntfy over Tailscale with no FCM, which Android does not keep alive reliably, and build 39 proved the loss. It becomes feasible only if the user accepts **one** of the following:
   - ntfy `upstream-base-url` through ntfy.sh, which is an FCM wake-up relay. This is the cheapest option.
   - a public ntfy endpoint.
   - our own FCM integration.

   Each also needs the always-on watcher, a raised approval timeout (B5) and the 5 s polling latency (B3).

Without one of those decisions, the "push to my phone when the apps are closed" requirement should be treated as **not achievable reliably**.

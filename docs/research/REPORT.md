# Hermes Agent v0.22.5 — client API for a custom chat frontend

## Summary

This report is based on Nous Research’s `hermes-agent` tag `v0.22.5` (`bf0203a`). Hermes code was not modified.

**Use port 9119, not 8642.** `hermes serve` and `hermes dashboard` are the same process. Desktop’s rich chat is JSON-RPC on `/api/ws` (258 legacy methods, 80 events, 16 server-to-client requests). The browser Chat page is a PTY of the TUI, so copy Desktop, not that page. Port 8642 is a separate gateway process with an API key, SSE chat, and jobs, and it does not serve `/api/ws` or clarify cards.

A Tailscale bind requires username/password (or OAuth). `--insecure` no longer skips that. Several clients can attach to one live session. HTTP CORS allows only localhost, so a phone PWA on another origin cannot call the API. Native apps can. There is no APNs, FCM, or Web Push. Routines edit, run-now, and run history are REST (`/api/cron/...`), not the `cron.manage` RPC. Session search is REST only.


Source: [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) tag `v0.22.5`, commit `bf0203a794a07aac3ff764972ab9087baa4e4f4e` (released 23 Oct 2026). Paths below are paths in that tree. The generated contract is `apps/shared/src/gateway-contract.openrpc.json` (258 legacy methods, 48 canonical methods, 80 event notifications, 16 server-to-client requests). Python in `tui_gateway/contracts/` is the source of that file (`scripts/gen_gateway_contracts.py`).

**Build the frontend against port 9119**, not 8642. `hermes serve` and `hermes dashboard` are the same process. Desktop’s rich chat speaks JSON-RPC on `GET /api/ws`. The browser dashboard’s Chat page is a PTY of the TUI, plus REST for cron, sessions, skills, and config. Port 8642 is a different process (the messaging gateway’s OpenAI-compatible adapter) and does not serve `/api/ws`.

## 1. Auth, sessions, multiple clients, CORS, Tailscale

### One server, two commands

`hermes dashboard` is the browser UI. `hermes serve` is the same gateway, headless: it skips the SPA build and never opens a browser. Both call `start_server`. Default bind is `127.0.0.1:9119`.

- `hermes_cli/subcommands/dashboard.py` lines 1–6, 15–19, 48–59, 92–101
- A machine-level server is the default. `--isolated` is a dedicated server for one profile. Without it, profile launches attach to one server and preselect a profile (`dashboard.py` lines 32–36). A sidebar of every profile should use the machine-level server.

### When a password is required

Any non-loopback bind requires an auth provider. Loopback is only `localhost`, `127.0.0.1`, and `::1`. RFC1918, CGNAT (Tailscale `100.64.0.0/10`), and link-local are treated as public. `--insecure` is accepted and ignored; it no longer disables the gate.

- `hermes_cli/web_server_boundary.py` `should_require_auth` (lines 106–113), `_LOOPBACK_HOST_VALUES` (line 18)
- `hermes_cli/web_server.py` `should_require_dashboard_auth` (lines 355–366)
- A non-loopback `dashboard.public_url` also engages the gate even if the process is bound to loopback (`public_hosts_engage_gate`, `web_server_boundary.py` lines 116–118).

### Two auth modes

**Loopback (auth gate off).** A process-wide secret `_SESSION_TOKEN` is minted at startup (`secrets.token_urlsafe(32)`) or taken from `HERMES_DASHBOARD_SESSION_TOKEN`. It dies with the process. The SPA HTML gets `window.__HERMES_SESSION_TOKEN__`. Callers send `X-Hermes-Session-Token` or `Authorization: Bearer <token>`. WebSocket upgrades send `?token=` and it is compared in constant time. Every local client shares this one secret. There is no per-user login.

- `hermes_cli/web_server.py` lines 218–225, 292–304, 318–340, 443–463
- `hermes_cli/web_server_dashboard.py` lines 158–172 (token withheld when the gate is on)
- `hermes_cli/web_server_chat.py` `_ws_auth_reason` lines 200–340

**Gated (non-loopback, including Tailscale).** The loopback token is not injected and is rejected on the WebSocket. Login is a provider session.

Providers live under `plugins/dashboard_auth/`: `basic` (username/password), `nous` (Nous Portal OAuth), `self_hosted` (OIDC). The shared gate is `hermes_cli/dashboard_auth/`.

Username/password (`BasicAuthProvider`, name `basic`):

- Config `dashboard.basic_auth.{username, password_hash|password, secret, session_ttl_seconds}`, or `HERMES_DASHBOARD_BASIC_AUTH_USERNAME`, `HERMES_DASHBOARD_BASIC_AUTH_PASSWORD`, `HERMES_DASHBOARD_BASIC_AUTH_PASSWORD_HASH`, `HERMES_DASHBOARD_BASIC_AUTH_SECRET`, `HERMES_DASHBOARD_BASIC_AUTH_TTL_SECONDS`. Env wins when set. Passwords are scrypt. Tokens are stateless HMAC-SHA256 blobs (access kind + refresh kind). Default access TTL is 12 hours; refresh TTL is 30 days. If `secret` is unset, a random per-process key is generated and sessions do not survive a restart or span workers. `revoke_session` is a no-op: logout does not invalidate other clients’ tokens before expiry.
- `plugins/dashboard_auth/basic/__init__.py` lines 1–8, 30–33, 114–183, 191–201, 213–253

Login HTTP:

| Step | Route | Result |
| --- | --- | --- |
| Provider list | `GET /api/auth/providers` | `{name, display_name, supports_password}` |
| Login page | `GET /login` | HTML form or OAuth buttons |
| Start OAuth | `GET /auth/login?provider=&next=` | Redirect; password providers bounce back to `/login` |
| Password | `POST /auth/password-login` JSON `{provider, username, password, next}` | `{ok, next}` and HttpOnly cookies. 401 generic, 429 rate limit, 503 if the store is down |
| Who am I | `GET /api/auth/me` | `{user_id, email, display_name, org_id, provider, expires_at}` |
| Logout | `POST /auth/logout` | Best-effort revoke, cookies cleared |
| WS ticket | `POST /api/auth/ws-ticket` | `{ticket, ttl_seconds}` — 30s, single-use |

- `hermes_cli/dashboard_auth/routes.py` lines 195–233, 439–565
- `hermes_cli/dashboard_auth/ws_tickets.py` lines 1–11, 20–21, 36–64
- `hermes_cli/dashboard_auth/middleware.py` `gated_auth_middleware` lines 160–219: cookie access token, else refresh, else 401. A presented `Authorization: Bearer` access token is verified with the same providers and does not use cookies (lines 171–184). Refresh of the same token is coalesced (`refresh_singleflight.py`).

Cookies (`hermes_cli/dashboard_auth/cookies.py` lines 1–14, 27–31, 59–106): `hermes_session_at` (access, Max-Age = token TTL), `hermes_session_rt` (refresh, 30-day browser cap), `hermes_session_provider` (routing hint). HttpOnly, `SameSite=Lax`, `Secure` only when the request scheme is https. Over plain `http://<tailscale-ip>:9119` the cookies are not Secure. On HTTPS the names become `__Host-` (or `__Secure-` behind a path prefix).

**Native / desktop token exchange** (RFC 8252): `GET /auth/native/authorize` then `POST /auth/native/token` with `{code, code_verifier}` returns bearer tokens in JSON and sets no cookie. Refresh is `POST /auth/native/refresh` with `{refresh_token, provider}`. The redirect URI must be `http://127.0.0.1` or `http://[::1]` with a canonical port. `localhost`, custom schemes, and a Tailscale IP are rejected (`routes.py` lines 236–276, 568–598). A Windows app that listens on loopback and opens the system browser can use this. A phone app cannot register a custom URL scheme as the redirect.

**WebSocket credentials** once the gate is on (`web_server_chat.py` lines 200–333), checked before the JSON-RPC session starts. Close code 4401 on failure (`chat_ws.py` lines 140–144):

1. `?ticket=` from `POST /api/auth/ws-ticket`, or the subprotocol pair `hermes-gateway-v1` plus `hermes-gateway-ticket.<ticket>` (`web_server_boundary.py` lines 151–167). The ticket subprotocol is not echoed back.
2. `?token=` holding a provider access token (verified with `verify_session`). This is how a “token-mode” remote Desktop connection works. The loopback `_SESSION_TOKEN` is not accepted here.
3. `?internal=` — process-lifetime credential for the server-spawned PTY child only. Never put this in a client.
4. Header `X-Hermes-Gateway-Ticket` is a local Desktop grant and is refused on `/api/ws` (`native_invalid`).

Host header: HTTP middleware rejects a Host that is not the bound hostname (`web_server.py` lines 369–387). WebSocket repeats that check and, when an `Origin` is present and is `http` or `https`, requires that origin’s host to match too (`ws_host_origin_reason`, `web_server_boundary.py` lines 192–218). Non-HTTP origins (`file://`, `null`, `app://`) are trusted; the credential is the real boundary. Binding `0.0.0.0` or `::` makes every Host and every HTTP Origin acceptable at this layer (`_is_accepted_host` lines 79–103). Binding the Tailscale IP keeps the check tight: clients must use that IP as Host and, if they send an HTTP Origin, as the origin host.

Public unauthenticated paths are only `/api/health`, `/api/status`, `/api/config/defaults`, `/api/config/schema`, `/api/model/info`, `/api/dashboard/themes`, `/api/dashboard/plugins`, and `/api/cron/fire` (the last carries its own JWT). `hermes_cli/dashboard_auth/public_paths.py` lines 9–27.

### Multiple clients at once

Yes, for one `hermes serve` process.

- Each WebSocket is its own transport. Live session events go through `FanoutTransport`: every attached peer gets an ordered mailbox. One slow socket does not stall the turn or the other peers. Overflow (16 384 frames or 4 MB) drops that peer; it must reconnect and replay. `tui_gateway/transport.py` lines 143–184.
- Membership in the fanout is what authorizes steer/interrupt for that session, so a second attached client can steer. `tui_gateway/server.py` lines 934–947.
- Basic-auth tokens are stateless, so two phones and a Windows app can each hold a login. Logout does not kill the others.
- `gateway.capabilities` reports `per_session_exclusive_submit: true` (`tui_gateway/methods_voice.py` lines 513–518; constant in `hermes_cli/active_sessions.py` lines 114–117). That lease stops a second *process* (a CLI on the VPS, another backend) from writing the same session. It is not a single-socket limit inside `hermes serve`.
- After `gateway.ready`, the client must call `client.capabilities` with `server_requests: true`. A socket that never does this has every server-to-client question failed immediately instead of waiting for the user (`methods_voice.py` lines 521–539).
- Reconnect: `gateway.ready` carries `replay_epoch`. `session.events.since` replays after a seq watermark; `truncated` means refetch state. A changed epoch means the process restarted and watermarks reset (`tui_gateway/ws.py` lines 544–553). The shared client heartbeats and treats a missed heartbeat as a dead socket (`apps/shared/src/json-rpc-gateway.ts` lines 41–57; WS send deadline comment in `tui_gateway/ws.py` lines 86–91). `ping` is answered on the read thread even mid-turn.

### CORS and a browser / PWA over Tailscale

HTTP CORS is localhost only:

```text
allow_origin_regex = ^https?://(localhost|127\.0\.0\.1)(:\d+)?$
```

`hermes_cli/web_server.py` lines 549–562. Methods and headers are unrestricted. There is no Tailscale or “any origin” setting.

Consequences:

- Opening `http://<tailscale-ip>:9119/` in a browser is same-origin. The built-in dashboard works. CORS does not apply. `hermes serve` (headless) does not serve that SPA; `hermes dashboard` does.
- A page hosted anywhere else (a phone PWA on another origin, a Vite dev server, a static host) cannot `fetch` the API. The preflight fails, including `POST /auth/password-login` and `POST /api/auth/ws-ticket`. Cookie `SameSite=Lax` would also withhold the session cookie on a cross-site call.
- A native Windows app is not subject to CORS. Use the loopback native-token flow, or a cookie jar plus a ws-ticket, or `Authorization: Bearer` on REST and `?token=<access>` on the socket.
- WebSocket Origin: an `http(s)` page whose host is not the bound host is closed with `origin_mismatch`, unless the process is bound to `0.0.0.0`/`::`. Electron-style `file://` / `app://` origins pass. A Capacitor/custom-scheme shell can pass the Origin check and still fail login if the login `fetch` is cross-origin.
- Practical Tailscale layout, matching `website/docs/user-guide/features/web-dashboard.md` (bind to the tailscale IP, username/password, do not publish the port on the public internet): native apps talk to `http://<tailscale-ip>:9119` with bearer or cookies; a browser UI must be served from that same origin (the dashboard itself, or a reverse proxy that fronts both the UI and `/api`). Do not bind `0.0.0.0` on a host that is also reachable off the tailnet. The code will require a password, but Host/Origin checks are then wide open.

## 2. JSON-RPC methods and WebSocket events

Transport: `tui_gateway/ws.py` mounts as `@router.websocket("/api/ws")` (`hermes_cli/web_routers/chat_ws.py` lines 696–734). Each WebSocket text message is one JSON-RPC 2.0 object. The stdio TUI uses the same objects newline-delimited. Dispatch is `tui_gateway.server.dispatch` unless this process has a session authority attached (see the canonical split below).

First frame the server sends:

```json
{"jsonrpc":"2.0","method":"event","params":{"type":"gateway.ready","payload":{"skin":{},"change_events":true,"heartbeat":true,"replay_epoch":"…"}}}
```

`session_authority: true` is added only when `app.state.session_authority` is set (`ws.py` lines 357–365, 548–553). A standalone `hermes serve` does not set that attribute (`gateway/run_api.py` lines 63–70 sets it only when the messaging gateway mounts the dashboard). On a normal VPS `hermes serve`, speak the legacy methods. If `gateway.ready` includes `session_authority`, session verbs go to the canonical set and unknown methods fall back to legacy when `ws_legacy_fallback` allows it (`ws.py` lines 368–385).

Event envelope (`apps/shared/src/gateway-events.ts` lines 56–82): `params.type`, `params.payload`, `params.session_id`, optional `params.seq`. Server-to-client questions are JSON-RPC **requests** (they have an `id` and a method name such as `approval`). The client answers with a JSON-RPC result for that id. `request.answer` covers a question the client never saw the frame for.

The client library is `apps/shared/src/json-rpc-gateway.ts` and `json-rpc-channel.ts`. Types are generated in `apps/shared/src/gateway-contract.generated.ts`.

### Profiles (the sidebar “bots”)

| Method | Role |
| --- | --- |
| `profiles.list` | Roster. Each row has `name`, `path`, `is_default`, `model`, `provider`, `description`, `display_name`, `skill_count`, `has_avatar`, and (with `include_sessions`) `last_session`, `worker_session`, `canonical_session` (“Bot Chat”). Also `install_id`. `tui_gateway/contracts/profiles_vault_complete_foreign_subagents.py` lines 151–185 |
| `profiles.create` | Create. `mirror_credentials` defaults on so a headless bot has a provider |
| `profiles.describe` | Soul, model pin, skills, toolsets, MCP — the profile editor |
| `profiles.configure` | Save a subset of those sections |
| `profiles.get_asset` / `profiles.set_asset` | Avatar as a data URL |
| `machine.facts` | OS account and machine, for a first-run label |
| `project.facts` | Structured facts for a cwd |

REST twins the roster: `GET/POST /api/profiles`, `PATCH/DELETE /api/profiles/{name}`, `PUT /api/profiles/{name}/model`, `PUT .../soul`, `PUT .../description`, `GET /api/profiles/sessions`, `GET /api/profiles/sessions/sidebar` (`hermes_cli/web_routers/profiles.py`).

There is no separate “bot” object. A profile is the bot. `profiles.list` is the sidebar.

### Chat and sessions

Legacy methods (`tui_gateway/methods_session.py` and the OpenRPC summaries):

| Method | Role |
| --- | --- |
| `session.create` | Mint a live session. The agent is built after the reply. A DB row appears on the first prompt unless the create is seeded |
| `session.list` | Stored human-facing sessions, newest first. Sub-agent and kanban sources are omitted |
| `session.most_recent` | One id, or null |
| `session.history` | Durable display transcript, ancestors included, row ids attached |
| `session.resume` | Reuse if already live in this process, otherwise lazy / deferred / cold rebuild |
| `session.activate` | Attach without closing the previously focused live session |
| `session.active_list` | Live sessions in this process only |
| `session.title` | Read or set. A title set before the row exists is queued |
| `session.delete` | Stored session and transcripts. Refused while it is live here |
| `session.archive` / `session.set_hidden` | Soft-hide. Hidden stays resumable by its owner |
| `session.close` | Tear down the live object. The stored row stays resumable |
| `session.branch` / `session.branch_stored` / `session.branch_whole` | Fork. `branch_stored` copies the transcript on the server so it never crosses the wire |
| `session.undo` | Drop the last user turn on an idle session |
| `session.compress` | Manual compress |
| `session.cwd.set` | Change cwd on a live idle session |
| `session.workspace.move` | Re-home the stored workspace |
| `session.save` | Export under `~/.hermes/sessions/saved` |
| `session.status` | Rendered status text |
| `session.context_breakdown` | Context-window split |
| `session.events.since` / `session.events.stats` | Reconnect replay and buffer stats |
| `session.foreign.list` / `.preview` / `.import` | Claude Code / Codex sessions found on the server |
| `session.info` event | Live settings snapshot; also the `info` returned by create/resume/activate |
| `sessions.changed` event | `state.db` moved; refetch the list |
| `session.title` event | Auto-title landed |
| `session.resume_progress` / `session.reclaimed` | Hydration progress, or the backend took the live session back |

**Search is not a JSON-RPC method.** It is `GET /api/sessions/search?q=&limit=&profile=` (FTS5 over message text, plus id match, compression lineage collapsed, branches kept). `hermes_cli/web_routers/sessions.py` lines 286–297. Other REST session routes in that file: list, get, messages, messages/around, timeline, export, latest-descendant, PATCH (rename/archive), DELETE, bulk-delete, import, prune, empty-count.

Sending a turn: `prompt.submit` (`tui_gateway/methods_prompt.py`). A busy session queues, steers, or redirects instead of refusing. Related: `session.redirect` (replace the active turn; queued while the agent is still building), `session.steer` (inject text into the next tool result without interrupting), `prompt.background` (fresh agent; result is `background.complete`), `prompt.btw` (side question; result is `btw.complete`).

Canonical methods, used when `session_authority` is set (`apps/shared/src/gateway-contract.openrpc.json` `x-canonical-methods`, contracts in `tui_gateway/contracts/canonical.py` and `canonical_sessions.py`):

`runtime.describe`, `session.create`, `session.resume`, `session.list`, `session.info`, `session.detach`, `session.interrupt`, `session.redirect`, `session.steer`, `session.stats`, `session.export`, `session.events.since`, `session.automation`, `session.prune`, `session.mutate`, `prompt.submit`, `prompt.cancel`, `prompt.receipt`, `prompt.replace_queued`, `prompt.resolve_unknown`, `prompt.steer_queued`, `approval.respond`, `clarify.respond`, `clarify.lock`.

`session.mutate` is the revision-fenced edit: rename, archive, sidebar, branch, delete, rewind, reset, model, reasoning, workspace, edit_policy, compress, import (`canonical.py` lines 107–109). `prompt.submit` on that path is an admission into a per-session FIFO. `session.detach` drops this socket’s subscription.

A client that only implements the legacy names still works on a stock `hermes serve`. Implement `session.mutate` as well if `gateway.ready.payload.session_authority` is true, because legacy session writers are then refused (`ws.py` lines 380–383).

### Streaming

Events (`tui_gateway/contracts/events.py`):

| Event | Payload |
| --- | --- |
| `message.start` | Turn began. Automation turns may carry a display card |
| `message.delta` | Assistant text chunk. `text: null` is a segment boundary before tool lines |
| `message.interim` | Commentary beside tool calls, sealed as its own segment |
| `message.complete` | Final text, usage, status `complete` / `error` / `interrupted` |
| `reasoning.delta` | Streamed reasoning chunk |
| `reasoning.available` | A finished reasoning block (non-streaming providers) |
| `thinking.delta` | Legacy thinking callback |
| `status.update` | Transient line. `kind` is `status`, `lifecycle`, `compacting`, `goal`, `loop`, `heartbeat`, `process`, … |
| `session.usage` | Mid-turn token/cost tick. `message.complete` is the authoritative final usage |
| `tool.generating` | Model is still emitting the tool arguments |
| `tool.start` | Call began: stable id and full args |
| `tool.progress` | MCP `notifications/progress`, throttled |
| `tool.complete` | Parsed result, summary, optional diff / todo |
| `tool.output_risk` | Output classified as risky |
| `todo.updated` | Full todo list |
| `error` / `notice` | Session-level failure, or a one-line notice |
| `agent.print` | Status line the agent printed |

Token frames are coalesced on the server (`tui_gateway/ws.py` lines 117–120) so a client should append deltas, not assume one frame per token. Sub-agent activity is a separate set: `subagent.spawn_requested`, `subagent.start`, `subagent.thinking`, `subagent.tool`, `subagent.progress`, `subagent.complete`. MoA (mixture of agents) has `moa.reference`, `moa.aggregating`, `moa.progress`, `moa.phase`.

RPC around a live turn: `subagent.list`, `subagent.tail` (last 16 KB), `subagent.steer`, `subagent.interrupt`, `delegation.status`, `delegation.pause`, `process.list`, `process.kill`, `process.stop`.

### Approvals and clarifying questions

These are server-to-client JSON-RPC requests (`tui_gateway/contracts/server_requests.py`), not events.

**Approval** (`server_requests.py` lines 166–196). Params: `session_id`, `request_id`, redacted `command`, `description`, `choices` (`once` | `session` | `always` | `deny`), `allow_permanent`, `allow_session`, `smart_denied`, `tool_name`, plus open tool context. Result: `{choice, all?}`.

How a client answers:

1. Reply to the request id with `ApprovalResult`, or
2. Call `approval.respond` (works after the session id has gone stale; falls back to a durable identity), and
3. Call `approval.received` once the card is on screen — that starts the timeout clock.
4. `approval.pending` replays cards still waiting (reconnect).
5. Event `approval.cancelled` means interrupt/reap/teardown resolved the wait as deny, not as a user refusal.
6. Event `request.cancel` withdraws one open question; clear only that card.

Default user wait is 300 seconds. The shared client uses the same deadline for `approval.respond` (`apps/shared/src/json-rpc-gateway.ts` lines 41–49).

**Clarify** (`server_requests.py` lines 36–60). Params: `questions[]` of `{qid, question, choices?, multi_select}` (1–5 questions). A reconnect replay may include `answers` already locked. Result: `{answers: {qid: string|null}, outcome?: submitted|timed_out|cancelled}`. A result without `answers` cancels all. While the card is open, `clarify.lock` locks one answer (still editable until every question is locked) and does not wait behind the turn (`ws.py` lines 107–110). Canonical path: `clarify.respond` is the generation-fenced answer (`x-canonical-methods`). `request.answer` answers an open server request the client never received.

Other server requests a minimal chat client will see and should decline with `{value: ""}` (empty means skipped): `sudo`, `secret`, `vault.code`, `vault.unlock_prompt`, `vault.save_login`, `display.install.sudo`. Desktop-only bridges: `preview.act`, `preview.read`, `terminal.read`, `window.read`, `theme.apply`, `theme.pick`, `tour`, `setup_beat`. Advertising `server_requests: true` means the server will send these. An unhandled method is a JSON-RPC error and fails the tool call. Answering with an empty value declines it.

`connection.request` / `connection.update` events and `connection.respond` / `connectors.connect` are the connector-auth cards (OAuth in a browser), separate from shell approvals.

### Interrupt and cancel

- `session.interrupt` stops the running turn and streaming TTS, and retires the crash-recovery marker.
- `session.redirect` replaces the active turn.
- `session.steer` does not stop the turn.
- `subagent.interrupt` / `process.kill` / `process.stop` target children and background processes.
- Canonical `prompt.cancel` retires a still-queued admission and does not stop one that has started.
- Event `voice.interrupted` is barge-in during speech.

### Attachments, files, images

| Method | Role |
| --- | --- |
| `image.attach` | Queue a path the gateway can read |
| `image.attach_bytes` | Base64 upload from a remote client. The reply matches `image.attach` |
| `image.detach` | Drop a queued image before send |
| `pdf.attach` | Render pages to PNG and queue them as images |
| `file.attach` | Stage a non-image into the session workspace; returns an `@file:` ref |
| `clipboard.paste` | Save the host clipboard image (useless from a phone; use `image.attach_bytes`) |
| `input.detect_drop` | Turn a terminal file-drop paste into an attachment |
| `paste.collapse` | Spill a large paste to a file |
| `image.generate` | Server-side image generation; returns a data URL |

The image metadata helper records width, height, and a rough token estimate (`tui_gateway/server.py` lines 885–894).

Dashboard REST file browser (server filesystem, not the chat queue): `hermes_cli/web_routers/files.py`, rooted at `HERMES_DASHBOARD_FILES_ROOT` (`web_server_files.py`). `GET /api/files/download` is the one route that also accepts `?token=`.

### Model and provider, per profile and per session

- Profile pin: `profiles.describe` / `profiles.configure`, REST `PUT /api/profiles/{name}/model`, and `config.get` / `config.set` (session-scoped or persisted).
- Picker inventory: `model.options` (optionally layered on the session’s live provider). `model.save_key` and `model.disconnect` write or remove provider credentials.
- Per session, legacy: the session info snapshot includes the model; a one-turn override rides the prompt. Canonical: `session.mutate` operations `model` and `reasoning`, and `prompt.submit` accepts `model_override` / `reasoning` for a single admission (`tui_gateway/contracts/canonical_sessions.py` around lines 198–227).
- `setup.status` / `setup.runtime_check` answer “is a provider configured?”.
- `config.show` is a masked summary. `reload.env` re-reads `.env`. Live agents keep their pool until a new session.
- REST model/provider pages: `hermes_cli/web_routers/config_env.py` (`/api/config`, `/api/env`, `/api/providers/custom-endpoints`, `/api/providers/validate`) and `hermes_cli/web_routers/models.py`.

### Cron / routines

JSON-RPC `cron.manage` (`tui_gateway/contracts/tools_commands.py` lines 438–529) actions are only `list`, `add`, `remove`, `pause`, `resume`. Optional `profile`. There is no edit and no run-now. Event `cron.changed` means `cron/jobs.json` moved; refetch.

The dashboard REST surface is the one that matches a Routines screen (`hermes_cli/web_routers/cron.py` lines 701–772, 891–910):

| Route | Role |
| --- | --- |
| `GET /api/cron/jobs?profile=` | List. `profile=all` is the default on the list route |
| `GET /api/cron/jobs/{id}` | One job |
| `GET /api/cron/jobs/{id}/runs?limit=` | Run history |
| `POST /api/cron/jobs` | Create |
| `PUT /api/cron/jobs/{id}` | Edit |
| `POST /api/cron/jobs/{id}/pause` and `/resume` | Pause / resume |
| `POST /api/cron/jobs/{id}/trigger` | Run now |
| `DELETE /api/cron/jobs/{id}` | Delete |
| `GET /api/cron/delivery-targets` | `local` plus gateway platforms |
| `GET /api/cron/blueprints` and `POST /api/cron/blueprints/instantiate` | Templates |
| `POST /api/cron/fire` | Inbound scheduler webhook (own JWT, not the user session) |

Canonical cron (`cron.submit`, `cron.status`, `cron.cancel`, `cron.recover`) is the gateway admitting a firing into a session FIFO, not the routines editor.

### Memory, skills, config

| Surface | What a client can do |
| --- | --- |
| `learning.frames` / `learning.detail` / `learning.edit` / `learning.delete` | Journey timeline, read or rewrite a `SKILL.md` or a memory chunk, archive a skill or drop a chunk |
| `skills.manage` | List the profile’s skills, or search / browse / inspect / install from the hub |
| `skills.reload` | Re-scan skill dirs |
| `skills.changed` event | A skill root changed; refetch `commands.catalog` |
| REST `hermes_cli/web_routers/skills.py` | `GET/POST /api/skills`, content read/write, toggle, hub search/install/update/uninstall |
| REST memory `hermes_cli/web_routers/ops.py` and `memory_providers.py` | `GET /api/memory`, `POST /api/memory/reset`, `PUT /api/memory/provider`, provider config/setup |
| `config.get` / `config.set` / `config.show` | Effective config. `config.set` can be session-scoped |
| REST `/api/config`, `/api/env` | The dashboard Config and Keys pages, including secret reveal |
| `tools.list` / `tools.show` / `tools.configure` / `toolsets.list` | Toolsets. `configure` persists and rebuilds the live agent |
| `mcp.servers.*` and `mcp.catalog` | List, add, remove, test, set API key, OAuth start/poll/cancel/callback. Status never connects |
| `commands.catalog` / `complete.slash` / `slash.exec` / `command.dispatch` | Slash commands, including plugin commands that ask the user to pick |
| `vault.*` | Local password vault and external managers. Unlock needs a master password |
| `plugins.list` / `plugins.manage` / `plugins.catalog.lookup` | Plugin hub |

### Usage and cost

- `session.usage` method and the `session.usage` event: token, context, and cost counters, plus Nous credit lines when the backend has them.
- `usage.bars`: the two-bar dollar view shared by `/usage`. Fail-open when unavailable.
- `billing.state` (read-only), `billing.step_up`, `billing.charge`, `billing.charge_status`, `billing.auto_reload`, `billing.keep_going_on_credits`.
- `subscription.state` / `.preview` / `.upgrade` / `.change` / `.resume`.
- `insights.get`: session and message counts over N days.
- `free_tier.status` and the rest of `free_tier.*` are the Nous free-tier bootstrap, not a self-hosted bill.
- REST analytics: `hermes_cli/web_routers/analytics.py`. Dashboard page `/analytics`.

### Notifications (in the socket, not on the phone)

- `notification.show` / `notification.clear`: a keyed toast or status-bar notice on this connection (`events.py` lines 492–493).
- `tip.show`: point at a desktop widget.
- `message.reaction` / `reaction` / `message.react`: emoji reactions.
- Change broadcasts, all with an empty-ish payload, so the client refetches: `cron.changed`, `sessions.changed`, `skills.changed`, `platforms.changed`, `projects.changed`, `pairing.changed`, `bot_relay.outbox.pending`.

### Everything else on the wire

Kept so the list is complete. A chat client can ignore these until it grows the feature.

- **Liveness:** `ping`, `gateway.capabilities`, `client.capabilities`, `terminal.resize`.
- **Voice / wake:** `voice.toggle`, `voice.record`, `voice.tts`, `wake.start|stop|pause|resume|status|feed`. Events `voice.status`, `voice.partial`, `voice.transcript`, `wake.detected`. `wake.feed` accepts PCM from a client when the server has no microphone.
- **Goals / loops:** `session.control`, `session.control.read`. Event `session.control.update`.
- **Groups / multi-bot rooms:** `groups.capabilities|create|list|log|send|state|stop|rename|disband|approve|retry|promote|demote|replica_state|replicate|peer.invite|peer.register|peer.revoke`. Canonical extras: `groups.attachment.upload|download`, `groups.discard`.
- **Bot relay:** `bot_relay.roster.sync|outbox.drain|deliver|reply`.
- **Projects:** `projects.list|get|create|update|delete|archive|add_folder|remove_folder|set_primary|set_active|for_cwd|tree|project_sessions|discover_repos|record_repos`.
- **Pets:** `pet.info|info.meta|gallery|thumb|select|rename|scale|disable|remove|export|cells|generate|generate.status|hatch|cancel`.
- **Display / “bot screen”:** `display.status|thumbnail|start|stop|observe|install|lease.acquire|lease.release|switchSandboxImage`. Needs Xvnc on the server.
- **Browser CDP:** `browser.manage`, `browser.controller.register|heartbeat|result|detach`.
- **Shell on the server:** `shell.exec` (non-dangerous only), `cli.exec` (`hermes <argv>`).
- **Onboarding / setup:** `onboarding.state|start|skip|set_run`, `setup.status|runtime_check`, `handoff.request|state|fail`.
- **Billing extras and Nous account:** `free_tier.*`, `diagnostics.share_nous`, `shared_metrics.*` (Desktop telemetry; no-op unless opted in).
- **Connectors:** `connectors.list|catalog|connect|tools|accounts|accounts.rename|accounts.remove|policy.get|policy.set|operation.status|operation.wake`.
- **Misc:** `i18n.languages|catalog`, `llm.oneshot`, `agents.list`, `rollback.list|diff|restore`, `spawn_tree.save|list|load`, `preview.restart`, `verification.status`, `insights.get`.

Server-to-client request names, full set (`x-server-requests`): `approval`, `clarify`, `sudo`, `secret`, `setup_beat`, `display.install.sudo`, `preview.act`, `preview.read`, `terminal.read`, `window.read`, `theme.apply`, `theme.pick`, `tour`, `vault.code`, `vault.save_login`, `vault.unlock_prompt`.

## 3. What Desktop and the dashboard show, and what is local-only

### Browser dashboard (`web/src/App.tsx` lines 141–221)

Routes: `/chat`, `/sessions`, `/files`, `/analytics`, `/models`, `/logs`, `/cron`, `/skills`, `/plugins`, `/mcp`, `/channels`, `/webhooks`, `/pairing`, `/profiles`, `/config`, `/env` (API keys), `/system`, `/docs`, plus plugin tabs.

The Chat page is an xterm attached to `WebSocket /api/pty`, which runs `hermes --tui` on the server (`web/src/pages/ChatPage.tsx` lines 12–14; `hermes_cli/web_routers/chat_ws.py` lines 538 and 696–699). `/api/ws` on that page is a sidecar so the React shell can show structured tool metadata beside the terminal. `/api/events` is the fan-out of those sidecar frames. A Grok-style transcript should not scrape the PTY. It should speak `/api/ws` the way Desktop does.

The Sessions, Cron, Skills, Models, Config, Keys, Channels, and Profiles pages are REST clients of the routes in section 2. Those REST calls are available to any authenticated client of the same process. They are not Electron-only.

### Hermes Desktop

The renderer uses `apps/shared` against `/api/ws` (`apps/shared/src/gateway-events.ts` lines 1–4; `apps/desktop/src/lib/gateway-rpc.ts`). Sidebar nav ids are `artifacts`, `capabilities`, `command-center`, `cron`, `messaging`, `new-session`, `settings` (`apps/desktop/src/app/types.ts` lines 130–131). Profiles are the bot list (`profiles.list`); sessions hang off a profile. Desktop also paints projects, pets, voice, the preview pane, group rooms, connectors, billing, onboarding, and the vault, all as RPC plus the server-to-client requests above.

Desktop’s remote mode is “URL of a `hermes serve` plus sign-in” (`website/docs/user-guide/desktop.md` around the `hermes serve --host 0.0.0.0 --port 9119` example; `website/docs/user-guide/multi-connection-desktop.md`). The app does not start that process.

### Only useful with a local GUI, or only on the server box

A remote phone or Windows client can drive anything that runs on the VPS: chat, tools, shell, files under the dashboard root, cron, memory, skills, config, MCP.

These need either a desktop renderer or hardware on the server:

- `preview.*`, `terminal.read`, `window.read`, `theme.apply`, `theme.pick`, `tour`, `tip.show`, `pane.reveal` — the server is asking the *client* to drive a window. Decline with an empty value.
- `clipboard.paste` and `input.detect_drop` — they read the machine that is running the backend, not the phone.
- `display.*` — Xvnc + Xfce on the gateway host (`methods_display.py`). A VPS without a display cannot start it. `display.observe` mints a ticket for `/api/display/ws`.
- `voice.record` captures audio on the backend unless the client pushes PCM with `wake.feed`.
- `/api/pty` — a real terminal on the server. Remote-attachable, but it is the TUI, not a widget API. A single-writer lease can hold a session (`chat_ws.py` `_lease_holder_pid`).
- `pet.*` — data is on the server; the sprite UI is Desktop’s.
- Computer-use / browser-controller registration expects a paired browser extension (`browser.controller.*`, and on 8642 `/v1/browser-control/*`).
- `shared_metrics.desktop_*` — telemetry from the packaged app.

`client.capabilities` also accepts `desktop_local`. Setting that marks the socket as the local Desktop and starts Desktop-only boot (`methods_voice.py` lines 530–538). A remote client should send `server_requests: true` and leave `desktop_local` unset.

## 4. Port 9119 versus port 8642

| | 9119 `hermes serve` / `hermes dashboard` | 8642 gateway `api_server` |
| --- | --- | --- |
| Process | `hermes_cli` web server. `dashboard.py` | Messaging gateway platform `gateway/platforms/api_server.py`. Started with the gateway, not with `serve` |
| Auth | Loopback session token, or username/password / OAuth session | `API_SERVER_KEY` bearer. The server refuses to start if the key is missing or weak (`api_server.py` lines 4408–4432). Not a user login |
| Chat API | JSON-RPC `/api/ws`: token deltas, reasoning, tool start/progress/complete, interactive approval and clarify | `POST /v1/chat/completions`, `POST /v1/responses`, `POST /api/sessions/{id}/chat` and `/chat/stream` (SSE) |
| Stream events | Section 2 | `run.started`, `message.started`, `assistant.delta`, `assistant.commentary`, `tool.progress` (also used for `reasoning.available`), `tool.started` / `tool.completed` / `tool.failed`, plus `approval.request` (`api_server.py` lines 3608–3630, 114–117) |
| Approvals | Inline server request, answered on the same socket | `POST /v1/runs/{run_id}/approval` with `once|session|always|deny`. Also steer, stop, resolve-unknown, `GET /v1/runs/{id}/events` |
| Clarify | First-class `clarify` request | Not a client question. Unattended platforms do not prompt (`tools/approval_context.py` treats `api_server` as unattended unless a run registered a notifier) |
| Sessions | Full list/history/resume/branch/search (search is REST) | `GET/POST /api/sessions`, get, `PATCH`, `DELETE`, messages, fork, `POST .../model` to lock the model. Header `X-Hermes-Session-Id` |
| Profiles as bots | `profiles.list` on the machine-level server | Prefix `/p/{profile}/...` mirrors every route (`api_server.py` lines 4474–4475). No roster RPC |
| Cron | REST edit, pause, trigger, run history. RPC list/add/pause only | `GET/POST /api/jobs`, get, `PATCH`, `DELETE`, pause, resume, `POST /api/jobs/{id}/run`. No run-history route in `_http_route_table` |
| Skills / tools | Hub install, edit, toggle, MCP OAuth | `GET /v1/skills`, `GET /v1/toolsets` (read-only). `features.skills_api` is true; `memory_write_api` and `admin_config_rw` are false (`api_server.py` lines 66–76) |
| Config, env, memory UI, channels, pairing, files, PTY | Yes, dashboard REST | No |
| CORS / browser | Localhost CORS; same-origin dashboard; WS origin check | aiohttp on the gateway. No dashboard cookie login |
| `/api/ws` | Yes | No. The TUI docs say pointing `HERMES_TUI_GATEWAY_URL` at this port 404s (`website/docs/user-guide/tui.md`) |

8642 is the right port for an OpenAI SDK, Open WebUI, or a small “send messages, list sessions, run a job” integration. It is a poor fit for a Grok-style app: no profile roster, no clarify cards, coarser tool events, no reasoning deltas as their own stream, no session FTS search, no cron run history, no memory/skills editor, and a different process from the one Desktop already uses.

Use 9119 as follows:

1. Password (or OAuth) login, then `POST /api/auth/ws-ticket`, then `ws://<host>:9119/api/ws?ticket=...` (or the ticket subprotocol, or `?token=<access>`).
2. On `gateway.ready`, send `client.capabilities` `{server_requests: true}` and `ping` on a timer.
3. `profiles.list` with `include_sessions` for the sidebar.
4. `session.create` / `session.resume` / `session.history` / `prompt.submit`, and render the stream events.
5. Answer `approval` and `clarify`; call `approval.received` and `approval.respond` / `clarify.lock`.
6. REST for search (`/api/sessions/search`), routine edit / run-now / run history (`/api/cron/...`), and the skills, memory, and config screens.

Both 9119 REST cron and 8642 `/api/jobs` edit the same cron store if they share a profile home. Driving routines through 9119 avoids a second auth scheme and a second port.

## 5. Gaps against the wanted client

Wanted: sidebar of profiles as bots, per-bot streaming chat, live tool activity, inline approvals and clarifying questions, a Routines view (list / edit / pause / run now), reopenable session history.

| Wanted | On 9119? |
| --- | --- |
| Profile sidebar | Yes. `profiles.list`. One machine-level `hermes serve`, not `--isolated` |
| Streaming replies | Yes. `message.delta` / `message.complete` |
| Reasoning | Yes. `reasoning.delta` and `reasoning.available` |
| Live tools | Yes. `tool.generating`, `tool.start`, `tool.progress`, `tool.complete` |
| Inline approval | Yes, if the client sends `client.capabilities` and answers the `approval` request |
| Clarifying questions | Yes. `clarify` + `clarify.lock` |
| Interrupt | Yes. `session.interrupt` |
| Images from the phone | Yes. `image.attach_bytes`. PDFs via `pdf.attach`. Other files via `file.attach` |
| Per-profile model | Yes. `profiles.configure` or `PUT /api/profiles/{name}/model` |
| Per-session model | Yes on the canonical path (`session.mutate`). On legacy serve, model changes go through `config.set` / the prompt’s model fields and `model.options`; there is no legacy method named `session.set_model` |
| Session list, resume, rename, delete, archive | Yes. `session.list`, `session.resume`, `session.history`, `session.title`, `session.delete`, `session.archive` |
| Session search | REST only. `GET /api/sessions/search`. No RPC |
| Routines list / pause / resume / create / delete | Yes. RPC `cron.manage` or REST |
| Routines edit, run now, run logs | REST only. `PUT`, `POST .../trigger`, `GET .../runs`. `cron.manage` cannot edit or trigger |
| Reopen history after the app was killed | Yes. State is on the server. Replay with `session.events.since` while the process stays up; after a restart, `session.resume` + `session.history` |
| Several clients on one bot | Yes, fan-out. A second OS process writing the same session is refused |
| Cross-origin PWA | No, unless the UI is served from the Hermes origin or a reverse proxy. Native apps are fine |
| Phone OS push when the WebSocket is dead | No. See section 6 |
| Dashboard Chat page as the protocol to copy | No. That page is a PTY. Copy Desktop’s `/api/ws` client |

Also missing if the product brief assumed them: multi-user accounts (basic auth is one username), server-side revoke of other devices, and a documented CORS allow-list for a Tailscale hostname.

## 6. Push and background delivery to a phone

Nothing on port 9119 registers a device with APNs, FCM, or Web Push. There is no service-worker push subscription in `web/` or `apps/`. `notification.show` is a toast on the open socket (`tui_gateway/contracts/events.py` lines 492–493).

What still works while the phone is asleep:

- The server keeps running. Cron fires inside the Hermes process. `POST /api/cron/jobs/{id}/trigger` does not need the phone to be connected.
- A live session with an active `/loop` or `/heartbeat` is exempt from the disconnect reaper, so those turns continue after the socket drops (`tui_gateway/session_reaper.py` lines 243–244). The process itself must stay up. `hermes serve` under systemd is the right place for that.
- On the next launch the client logs in, `session.resume`s, and `session.history` (and `session.events.since` if the same process is still up and the replay epoch matches).

To poke the phone while it is backgrounded, use a messaging platform on the separate gateway process, not the dashboard socket. Documented channels include Telegram, Discord, Slack, Signal, and ntfy (`website/docs/user-guide/messaging/`; ntfy is `website/docs/user-guide/messaging/ntfy.md`). Cron jobs take a `deliver` target (`GET /api/cron/delivery-targets`). `deliver: "ntfy"` (or another platform) is how a finished routine reaches a phone. That requires `hermes gateway` running beside `hermes serve`, with the platform configured. The 9119 API will not deliver an OS notification by itself.

A client that wants “something finished” without a messaging bridge can only poll (`session.list`, `GET /api/cron/jobs/{id}/runs`) or hold the WebSocket open. Mobile OSes will suspend that socket. Plan on a cold resume, not a push.

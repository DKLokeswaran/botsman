# Hermes Bots architecture

Hermes Bots is a Windows and Android client for a self-hosted Hermes Agent, plus one companion Hermes plugin. There is no separate server. Everything server-side is stock Hermes, Hermes config, or the plugin. The constraints behind this design are in [BLOCKERS.md](BLOCKERS.md).

## Components

```text
 Windows app ─┐                        devbox (Tailscale)
              │  HTTPS/WS over      ┌──────────────────────────────────────────┐
 Android app ─┼─ Tailscale ───────► │ hermes dashboard  :9119                  │
              │                     │   /api/ws (JSON-RPC), REST               │
              │                     │   hermes-bots plugin                     │
              │                     │     /api/plugins/hermes-bots/…  (bridge) │
              │                     │          │ gateway.sock + loopback /api/ws│
              │                     │          ▼                               │
              │                     │ hermes gateway                           │
              │                     │   Bot Chat sessions, cron, Discord       │
              │                     │   hermes-bots plugin (push hooks)        │
              │                     └──────────────┬───────────────────────────┘
              │                                    │ HTTPS POST
              │   push (FCM wake-up)   ┌───────────▼──────┐
              └──── ntfy app ◄──────── │ ntfy.sh          │
                                       └──────────────────┘
```

- **Clients.** Native networking only (B10). They talk to the dashboard on port 9119 and never to the gateway directly.
- **Dashboard (`hermes dashboard`).** Login, REST, and the JSON-RPC socket `/api/ws`. It runs side chats and every other non-Bot-Chat session.
- **Gateway (`hermes gateway`).** Owns each profile's Bot Chat, runs cron, and delivers routine output into Bot Chat.
- **`hermes-bots` plugin.** Installed in the Hermes home and enabled in `plugins.enabled`. It loads in both processes and has two jobs: the Bot Chat bridge (dashboard side) and push (both sides).
- **ntfy.sh.** Push transport. The Android app receives through the ntfy app (Play Store build, which uses FCM for ntfy.sh). Windows uses the app's own tray notifications.

## Bots and chats

| Concept | Hermes object | Notes |
|---|---|---|
| Bot | Profile | `profiles.list` is the roster. One machine-level dashboard serves every profile |
| Main chat | The profile's Bot Chat | The `canonical_session` in `profiles.list`, owned by the gateway |
| Side chat | Ordinary session | `session.create` on the dashboard, owned by the dashboard |
| Bot metadata the app adds | `ui_meta` on the profile | Free-form JSON with per-key compare-and-swap (`profiles.configure` with `ui_meta_expected_revisions`) |

## Routines

- A routine is a cron job with `deliver: "bot-chat"` (own profile) or `"bot-chat:<profile>"`, combinable with other targets.
- Create, edit, pause, resume, run now, run history and delete use the dashboard REST routes under `/api/cron/jobs`.
- The routine's output enters Bot Chat as a turn with the prefix `[Cronjob "<name>" output ...]`. The bot then runs a full turn on it, which costs one agent turn per run.
- The routine run itself can never ask for approval (cron mode deny). The Bot Chat follow-up turn can, and those approvals reach the app through the bridge.
- The bot acts on whatever the routine outputs. Routine prompts should say plainly what the bot is expected to do with the result.

## Main chat through the bridge

The plugin's dashboard routes hold one gateway connection per attached Bot Chat:

1. Connect with `hermes_cli.gateway_client.connect_gateway()`. The plugin runs as the same OS user as the gateway, which is what the gateway's control socket requires.
2. Send `client.capabilities {server_requests: true}`.
3. `session.resume` with the Bot Chat's stored id.
4. Relay every gateway frame to the app, and relay the app's calls and answers back.

Protocol on the gateway side:

| Action | How |
|---|---|
| Send a message | `prompt.submit {session_id, text, submission_id, clarify_batch: true}`. The result is an admission; the turn runs in FIFO order |
| Approval request | Event `approval.request {prompt_id, execution_generation, command, description, choices}` |
| Answer an approval | `approval.respond {session_id, prompt_id, execution_generation, choice}` |
| Approval finished | Event `approval.settled` |
| Clarifying question | Server request `clarify {questions: [{qid, question, choices}]}` (with `clarify_batch: true`) |
| Answer a question | JSON-RPC result `{answers: {qid: value}, outcome: "submitted"}` |
| Cancel a queued message | `prompt.cancel {session_id, admission_id}` |

The plugin routes sit behind the dashboard login (an unauthenticated request gets 401). The production bridge transport is open. The test used HTTP long-polling, and whether WebSocket routes in a plugin are behind the login has not been checked.

## Side chats on the dashboard

Side chats use the dashboard socket directly, the way Hermes Desktop does:

- Connect with a ticket from `POST /api/auth/ws-ticket` (single use, 30 s).
- After `gateway.ready`, send `client.capabilities {server_requests: true}` and heartbeat with `gateway.ping`.
- Approvals and clarifying questions arrive as server requests and are answered with a JSON-RPC result.
- Resume by stored id. Treat a new `replay_epoch` or a truncated replay as a reset and refetch with `session.history`.

## Model and reasoning per chat

- Model: `config.set {key: "model", value: "<model> --session", session_id}`. Always include `--session`, because a bare model pick can persist globally under some configs. The pick is stored with the session and restored on resume. New chats keep the profile default.
- Reasoning: `config.set {key: "reasoning", value: "<level>", session_id}`. It is stored in the session's `model_config.reasoning_config`.
- Resume is lazy, so `session.info` reports `reasoning_effort: null` until the agent is rebuilt on the next turn. The app shows the stored value until then. `session.resume` has an `eager_build` option that may avoid this (untested).
- For Bot Chat, a composer pick is restored only while the profile's model is unchanged.

## Sync across devices

All shared state lives in Hermes, and the clients store only the login.

- Pin, archive, hide and read state are session columns. Write them with `PATCH /api/sessions/{id}` and a body of `{pinned | archived | hidden | unread, request_id, expected_revision}`. `expected_revision` is the session's current `runtime_revision`. Without `request_id` and `expected_revision` the server returns 409.
- `unread: false` sets the shared `last_read_at` watermark to now. There is no per-device read state.
- Other clients learn about changes through `sessions.changed` (empty payload, at most once per 2 s) and refetch.
- Bot-level app data goes in profile `ui_meta`.

## Push

The plugin's hooks run in whichever process runs the turn:

| Hook | Push |
|---|---|
| `pre_approval_request` | "<bot> needs approval" |
| `on_human_input_request` (kind `clarify`) | "<bot> has a question" |
| `post_approval_response`, `on_human_input_resolved` | clear the pending alert |
| `on_session_end` | "<bot> finished" (for long turns and routine follow-ups) |

The plugin POSTs to an ntfy.sh topic. Messages carry no conversation text, only the bot and the kind of event, and the app fetches details when opened. The topic should be reserved behind an ntfy.sh access token. A click action deep-links into the chat.

## Login

- `POST /auth/password-login` with `{provider: "basic", username, password}` sets the session cookies. The app keeps the cookie jar and nothing else.
- Access tokens last 12 hours and refresh tokens 30 days. A fixed `HERMES_DASHBOARD_BASIC_AUTH_SECRET` keeps sessions valid across restarts.
- When the refresh token expires, the app shows the login screen with the username filled in.

## Versioning

- Pin Hermes to one tag (currently v0.22.5) and do not auto-update.
- Generate client types from `apps/shared/src/gateway-contract.openrpc.json` at the pinned commit.
- At connect, check `/api/status` `version` and `session.info.desktop_contract` (currently 8). Refuse to run against an unknown combination with a clear message.
- Before an upgrade, run the contract checks and the plugin tests against a test instance (BLOCKERS.md, B12).

## Open decisions

- Desktop and mobile stack.
- Side chats or Grok-style message threads for in-context replies.
- Bridge transport: WebSocket route or long-polling.
- Push content: content-free messages (this design) or full text through ntfy.sh.

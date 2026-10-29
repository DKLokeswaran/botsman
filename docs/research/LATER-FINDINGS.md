# Later findings (learned during the build)

Protocol facts about the Hermes `tui_gateway` (git `bf0203a`) that were confirmed against the running server while building the Hermes Bots apps. They add to [REPORT.md](REPORT.md).

## Session ids

- Each session has two ids: a **runtime id** (8 hex characters, for the live in-memory session) and a **stored session id** (the persisted one).
- `session.resume` accepts only **stored** ids. Passing a runtime id returns error **4007**.
- `session.activate` attaches an extra client to a live session by **runtime** id. An unknown runtime id returns error **4001**.

## Approvals across several clients

- Approval requests fan out to every client that declared `client.capabilities` with `{server_requests: true}`.
- The first answer wins. The other clients get `request.cancel` for that request.

## Events and heartbeat

- `sessions.changed` is debounced, so expect one event after a burst of changes rather than one per change.
- The heartbeat method is `gateway.ping`.

## Network and login

- Hermes is bound to `http://100.113.35.96:9119` (Tailscale IP). A request with a MagicDNS host name in the `Host` header gets **400 Invalid Host header**, so clients must use the IP.
- Login is cookie based (`POST /auth/password-login` sets HttpOnly cookies), then `POST /api/auth/ws-ticket` returns a **single-use ticket valid for 30 seconds**, which is passed when opening `/api/ws`.

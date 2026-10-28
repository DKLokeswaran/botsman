# Hermes gateway contract (v0.22.5)

`gateway-contract.openrpc.json` is the OpenRPC document from Hermes Agent tag v0.22.5, commit `bf0203a794a07aac3ff764972ab9087baa4e4f4e`. Hermes is MIT licensed (Nous Research). This repository copies that JSON file only. The TypeScript and Kotlin clients are written from the contract. They are not a copy of `apps/shared` in the Hermes tree. See `NOTICE.md`.

`check_contract.py` fails if a method the clients call is missing, or if `gateway.ping` shows up inside the file. `gateway.ping` is the heartbeat. The gateway answers it on the WebSocket read thread, and it is not an OpenRPC method. The OpenRPC method `ping` is a normal queued call. The clients heartbeat with `gateway.ping`.

## What the thin clients do

Both clients take an HTTP stack and a socket from the outside.

- `POST /auth/password-login` returns session cookies, not a bearer body. The clients read `hermes_session_at`, `hermes_session_rt`, and `hermes_session_provider`, including the `__Host-` and `__Secure-` names used on HTTPS.
- Saved login keeps the refresh token and calls `POST /auth/native/refresh`. The password is not stored.
- `POST /api/auth/ws-ticket` takes `Authorization: Bearer`. The ticket lasts 30 seconds and works once. The socket is `/api/ws?ticket=`.
- After `gateway.ready` the client sends `client.capabilities` with `server_requests: true`.
- Profiles, sessions, resume, history, and `prompt.submit` use the legacy method names. A stock `hermes serve` does not set `session_authority`. If a future server does, these names are the wrong set. The ready flag is surfaced so the app can say so.
- `session.events.since` returns event params (not full JSON-RPC frames) plus `open_requests`. The clients re-dispatch both.
- An approval answer is `{choice: "once"}` or `{choice: "deny"}`. The apps also call `approval.received` when the card is on screen.

## One socket and many sessions

A session event reaches only the sockets attached to that session. `session.resume` and `session.activate` add this socket and do not detach the others. Session-less events reach every connected socket. The notifier resumes each live session it watches. The test apps resume the session the user opened.

## Fake server

`fake/hermes_fake.py` is a small JSON-RPC gateway used by the unit tests. Its only account is `tester` / `tester`, and that pair exists only inside the test process. It is not a Hermes login.

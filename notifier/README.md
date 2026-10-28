# Hermes Bots notifier

A small Python process for the devbox. It logs in to Hermes v0.22.5, watches a few events, and POSTs them to an ntfy topic or a UnifiedPush endpoint. The standard library is the only dependency.

It binds its health port to the host you set (`BIND_HOST`, for example `100.113.35.96`). If that bind fails it exits. It does not fall back to `0.0.0.0`.

`HERMES_URL` has to be the address Hermes is bound to, `http://100.113.35.96:9119`. The MagicDNS name is rejected with HTTP 400 `Invalid Host header`.

## What one socket can see

Checked in Hermes v0.22.5 (`tui_gateway/server.py` `write_json`, `session_transports.py`, `server_requests.py`).

A session event is written only to the transport attached to that session. Attaching is additive: `session.activate` and `session.resume` add this socket to the session's fan-out and do not detach the others. Disconnect removes it from every session.

Events with no session (profile and cron change notices, skin changes) go to every connected socket.

A server-to-client request such as `approval` or `clarify` is also routed to the session transport, so every socket attached to that session sees it. Hermes sends the request only when at least one attached socket has advertised `client.capabilities` with `server_requests: true`, or when nobody is attached yet (the question then waits in `open_requests`). If every attached socket stayed silent about that capability, Hermes withdraws the question immediately.

The first real answer wins. A JSON-RPC error `4404` is a "not shown here" decline. The question stays open until every answering client has declined that way. Any other response, including a result of `{value: ""}`, settles it.

## How this process behaves

- One socket. After `gateway.ready` it sends `client.capabilities` with `server_requests: true`, so a question is not thrown away when this is the only peer.
- Every few seconds it calls `session.active_list` and `session.resume` (with `omit_messages: true`) for each live id it has not joined. It does not attach idle stored sessions.
- It does not answer approvals, questions, or any other server request. Answering would steal the prompt from the Windows or Android app. A real Allow or Deny on those apps still settles the question at once.
- It notifies on `approval`, `clarify`, a finished `message.complete`, and an error event.
- A reply that starts and finishes in the gap before the next poll can be missed. Five seconds is the default. The phone and the Windows app still have `session.events.since` for themselves.
- Heartbeats are `gateway.ping` every 15 seconds. That method is answered on the gateway read thread. It is not the OpenRPC method named `ping`.

## Credentials

Copy `notifier.env.example` to a path outside the repo, or to `notifier.env` in this directory (that filename is gitignored). Fill in the Hermes username and password yourself. Nothing in the repo or in CI has a real login.

The process prints `logged in as <username>` and one `NOTIFY` line per event. The line is the JSON body it POSTs. It does not print the password, the refresh token, or the websocket ticket.

```json
{"kind":"approval","title":"Approval waiting","body":"Read the repo","session_id":"…","profile":"default","request_id":"…","message_id":"","seq":null}
```

`kind` is `approval`, `clarify`, `reply`, or `error`. `profile` is filled when the session list included one. Approvals and questions set `request_id`. Replies set `message_id` (the persisted row id when Hermes sent one) and `seq`. The encoded body stays under 4 KB. The POST is `Content-Type: application/json`, with `Title` and `Tags` headers. There are no new environment variables.

`NOTIFY_URL` is an ntfy topic URL or the endpoint string shown on the Android settings screen. `NOTIFY_TOKEN` is optional and is sent as `Authorization: Bearer`.

Copy the new `hermes_notify.py` over the one the service runs, then restart it. Nothing else in `notifier.env` changes.

```bash
systemctl --user restart hermes-bots-notify.service
```

A tmux process needs the same script and a new session. Install the new Android APK at the same time. The new app still opens the home screen for an old plain-text body. The previous app would show a JSON body as raw text.

## Dry run

`--dry-run` still logs in, still watches, and still prints each `NOTIFY` line. It does not POST.

```bash
python3 notifier/hermes_notify.py --env-file ~/.config/hermes-bots/notifier.env --dry-run
```

`GET http://<BIND_HOST>:<BIND_PORT>/health` returns `ok`.

## systemd user service

```bash
mkdir -p ~/.config/hermes-bots
cp notifier/notifier.env.example ~/.config/hermes-bots/notifier.env
# edit the env file on the machine. do not commit it.

mkdir -p ~/hermes-bots
cp notifier/hermes_notify.py ~/hermes-bots/notifier/hermes_notify.py
mkdir -p ~/.config/systemd/user
cp notifier/hermes-bots-notify.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now hermes-bots-notify.service
journalctl --user -u hermes-bots-notify.service -f
```

The unit sets `Nice=10` and restarts on failure. It stays on the user session, so lingering must be enabled if it should survive logout (`loginctl enable-linger "$USER"`).

## tmux

```bash
tmux new-session -d -s hermes-notify \
  "python3 ~/hermes-bots/notifier/hermes_notify.py --env-file ~/.config/hermes-bots/notifier.env"
```

The process is one Python interpreter, one socket, and a poll every few seconds.

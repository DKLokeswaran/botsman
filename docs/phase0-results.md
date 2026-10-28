# Phase 0 results

This file records what was exercised while the test apps were built, and what still needs a Windows 11 PC and an Android phone on the tailnet.

## Verified here

- Hermes v0.22.5 contract file is pinned. `contract/check_contract.py` accepts it. The methods the clients call, including `approval.respond`, are in the file. `gateway.ping` is not in the file, which matches the gateway source.
- The TypeScript client tests pass against `contract/fake/hermes_fake.py`: bad password, cookie login, single-use ticket, refresh rotation, `gateway.ready`, `client.capabilities`, one approval, profiles, sessions, a prompt and `message.complete`, then a second connection that refreshes and replays with `session.events.since`. A separate test connects two clients: both see the same approval, one calls `approval.respond`, the other receives `request.cancel` with reason `resolved`, and a later replay does not return that approval in `open_requests`. The same suite checks that a push JSON round-trips and that an approval, a question, and a reply route to a card or a transcript line.
- The Kotlin client tests pass against the same fake server for the same cases, including the two-client approval.
- `notifier/test_notify.py` passes. Dry-run against the fake server prints an approval and a finished reply, and does not answer the approval. The notifier keeps any websocket bytes that arrived in the same packet as the HTTP 101, so `gateway.ready` is not dropped. Each `NOTIFY` line is compact JSON under 4 KB, with `kind`, `session_id`, `request_id` or `message_id`/`seq`, `title`, and `body`.
- `tokens/build_tokens.py --check` matches `tokens/zoetrik.json`.
- The Windows frontend typechecks and `vite build` succeeds.
- `cargo check` of the Tauri shell succeeded on Linux, including the tray, native HTTP, WebSocket, notification, autostart, and single-instance plugins. The Credential Manager and AppUserModelID code is `cfg(windows)`.
- The Windows CI job passed on run 40610659845 and again on run 40613413473. The unsigned installer is the artifact `hermes-bots-windows-setup`.
- `./gradlew :hermes-client:test assembleDebug` succeeded on this machine. The debug APK is `apps/android/app/build/outputs/apk/debug/app-debug.apk`. The copy to install is the CI artifact `hermes-bots-android-debug`, uploaded by the Ubuntu job on run 40613413473. The first Ubuntu run (40610659845) failed in `android-actions/setup-android@v3` because that action still installs the removed SDK package `tools`. The workflow now uses `setup-android@v4` and asks only for `platform-tools`, `platforms;android-37.0`, and `build-tools;36.0.0`. Run 40612455516 installed that SDK, then the contract typecheck exited 1: `npx --prefix` does not change the working directory, so `tsc` ran from the repo root and printed its help. The step now runs `tsc -p contract/ts --noEmit`. That step, the Kotlin tests, `assembleDebug`, and the APK upload all passed on run 40613413473.

The fake server's only account is `tester` / `tester`. That pair is not a Hermes login and is not a secret.

## Needs your devices

- Password login against the real Hermes on devbox, from both apps.
- Credential Manager and the Android Keystore across a real restart, and the prefilled username after a real expiry.
- A real profile list, a real session, a real model reply, markdown from that reply, and a real approval card.
- A dropped Tailscale socket and `session.events.since` against the real gateway.
- Tamil and Hindi input on a real keyboard and a real Android IME.
- Image paste and the file picker on both devices. Thumbnails only. No upload.
- UnifiedPush with ntfy installed on the phone. A structured notification should open the session and outline the approval, question, or reply. **Allow once** and **Deny** are on the approval notification. Plain text still opens the home screen.
- The Windows tray, close-to-tray, single instance, autostart, and a toast from the installed unsigned exe. A toast click, or tray **Open** after that toast, should land on the same session. SmartScreen and Smart App Control are described in the test plan.
- The notifier process actually running on devbox, bound to the Tailscale address, posting to your topic or to the phone endpoint.

## What the Hermes report got wrong

The API report is right about port 9119, password login returning cookies, the 30-second single-use ws-ticket, CORS limited to localhost, `client.capabilities` with `server_requests: true`, and replay through `session.events.since`.

One name is off. The report says `ping` is answered on the read thread and that the client should send `ping` on a timer. In v0.22.5 the heartbeat method is `gateway.ping`. The gateway answers that on the WebSocket read thread, and it is not in the OpenRPC file. `ping` is a normal OpenRPC method and is queued with the other calls. The test apps heartbeat with `gateway.ping`.

`hermes serve` and `hermes dashboard` share one server. `serve` is headless. `dashboard` also serves the browser UI. The report already says that.

`session_authority` is only present when the messaging gateway mounted the dashboard. A normal `hermes serve` does not set it. The apps speak the legacy session methods and show the flag when it is true.

The dashboard rejects a Host header that is not the bound address or the configured public hostname. `devbox.tail2eeb02.ts.net` returns HTTP 400 `{"detail":"Invalid Host header. Dashboard requests must use the bound hostname or the configured public hostname."}`. The bound address `http://100.113.35.96:9119` is accepted. Both apps default to that IP. Login and refresh failures show the status and `detail`, and a transport failure shows the reason plus the URL. Passwords, cookies, and tokens are not included.

## Judgment calls

- minSdk is 26. compileSdk is 37 because current Compose (1.12, BOM 2026.09.00) requires it. The Android Gradle Plugin is 9.4.1 with built-in Kotlin 2.4.21, which is what that plugin set accepts. targetSdk is 35 so the process stays on Android 15 rules, including edge-to-edge. The screen pads with the safe drawing insets unioned with the IME inset.
- UnifiedPush and `security-crypto` both ship Tink classes. The JVM `tink` jar is excluded so the Android `tink-android` jar is the one that is packaged.
- The saved secret is the refresh token, plus the username and provider. The password is not written. The server URL is ordinary preferences, not a secret.
- The Windows vault is the `keyring` crate talking to Credential Manager, behind Tauri commands. The official Tauri plugins do not wrap Credential Manager. Stronghold was not used.
- The notifier joins sessions that are already live. It advertises `server_requests` so Hermes does not drop a question when the notifier is the only socket. It never answers. A real Allow or Deny from an app still settles the question. See `notifier/README.md`.
- The clients are a thin hand-written set checked against the contract, not generated wrappers for all 258 methods.
- A notifier push is a JSON object under 4 KB. The Android app reads it into the matching session. An approval or question that is no longer open is shown as **Resolved**. Unknown server requests are still answered with `{value: ""}`, except a clarify that the pending notification is asking to show. No new notifier environment variables. Restart the notifier after copying `hermes_notify.py`, and install the new APK with that copy.
- Phase 0 approval buttons are Allow once and Deny. The card is rendered once, after the transcript. Answering calls `approval.respond` so Hermes can emit `request.cancel` while the server request is still open. The device that tapped clears the card. Every other client marks it **Approved on another device**. A replay that no longer lists the request does not put the buttons back. Unknown server requests from the apps are answered with `{value: ""}` so a question the test UI cannot show does not sit forever. A clarify that the notification the user just opened is asking to show is the exception. That empty answer does settle the question.
- Android image paste, image pick, and file pick sit in the attach menu beside the message field. A Compose text field does not receive an image paste the way a Windows textarea does. The field is given no minimum width, so the attach icon, the field, and the send icon fit a 360dp screen without a horizontal scroll.
- Attachments are shown and not uploaded.
- The Windows installer is an unsigned per-user NSIS exe. No paid signing.
- CI runs on pull requests and on pushes to `main`, with path filters, so a push to the pull request branch is not built a second time. The repository is private and the workflows stay on the free runners.

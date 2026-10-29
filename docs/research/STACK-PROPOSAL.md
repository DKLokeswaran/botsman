# Hermes Bots: tech stack proposal

**Recommendation: Tauri v2 + React/TypeScript + shadcn/ui (Tailwind).** One codebase gives you an Android APK and a Windows setup .exe. The approved mockups and the Zoetrik theme carry over almost as-is, and it talks to Hermes directly. The one exception is a small notifier on devbox, explained in Risks below.

## Two facts from Hermes that shape every option
- **A webview can't call Hermes the normal way.** Hermes only allows `localhost` origins for HTTP calls from a page (CORS). Its WebSocket also rejects any `http(s)` Origin that isn't devbox's own address. In Tauri, the app's page runs at `http://tauri.localhost` on Windows and Android ([Tauri config](https://v2.tauri.app/reference/config/)), so the page's own `fetch` and `WebSocket` would be blocked. The fix is to send every call through native code: Tauri's Rust-side [HTTP plugin](https://v2.tauri.app/plugin/http-client/) and [WebSocket plugin](https://v2.tauri.app/plugin/websocket/). Both support Android and Windows and aren't subject to CORS. Flutter and React Native are native already, so this problem doesn't arise for them.
- **Hermes has no push of its own.** Routine results can reach ntfy through Hermes's own ntfy delivery. But approvals, questions, "long reply finished" and errors only exist on the live socket. While the phone app is closed, something on devbox has to watch for them and send them to ntfy (see Risks).

## Options compared
| | **A. Tauri v2 + React/TS + shadcn** | **B. Flutter** | **C. Expo (Android) + React Native Windows** |
|---|---|---|---|
| Android + Windows | Both stable in Tauri 2. Mobile is newer, with fewer plugins | Most mature on both | Expo doesn't support Windows ([issue](https://github.com/microsoft/react-native-windows/issues/13534)), so it's really two app setups |
| UnifiedPush | No plugin yet. We'd write a small Kotlin plugin on the official [android-connector](https://unifiedpush.org/kdoc/connector/) (v3.3.5) | Official [`unifiedpush`](https://pub.dev/packages/unifiedpush) package | Third-party [expo-unified-push](https://github.com/juandjara/expo-unified-push), with one maintainer |
| CORS / WS Origin | Blocked from the webview. Fixed by the native HTTP and WS plugins above | No CORS (dart:io) | No CORS |
| Secure login storage | Community [secure-keystore](https://crates.io/crates/tauri-plugin-secure-keystore) (Android Keystore and Windows Credential Manager). The official Stronghold plugin is [deprecated](https://github.com/tauri-apps/plugins-workspace/issues/3494) | [flutter_secure_storage](https://pub.dev/packages/flutter_secure_storage) | expo-secure-store; Windows needs separate work |
| Windows tray, toasts, installer | Built-in [tray](https://v2.tauri.app/learn/system-tray/), [notification plugin](https://v2.tauri.app/plugin/notification/), NSIS/MSI [installer](https://v2.tauri.app/distribute/windows-installer/), [updater](https://v2.tauri.app/plugin/updater/) | [tray_manager](https://pub.dev/packages/tray_manager), [local notifications](https://pub.dev/packages/flutter_local_notifications), MSIX or Inno Setup | RNW has its own APIs and needs custom work |
| Zoetrik theme / mockup fidelity | **Exact.** `theme.css` is shadcn variables, and the mockups are already HTML/CSS | Rebuilt by hand as Flutter widgets. Close, not pixel-exact. Markdown package churn ([flutter_markdown discontinued](https://pub.dev/documentation/flutter_markdown/latest/)) | Approximate, via NativeWind/RN Reusables |
| Built on cloud-agent Linux VMs | APK: yes. Windows: an experimental NSIS cross-build, so the real build runs on GitHub Actions | APK: yes. Windows: **no**, it [needs a Windows host](https://github.com/flutter/flutter/issues/110585) | APK: yes. Windows: no |
| AI-agent friendliness | React/TS is the best-documented stack. Hermes's own client (`apps/shared`, TypeScript JSON-RPC and generated types) can be ported or reused | Good docs, but Dart, and nothing from Hermes can be reused | Two native toolchains |

**Why A:** your top three priorities are "great on phone", "great on Windows" and "looks beautiful". A reproduces the approved design exactly and lets us reuse Hermes's own TypeScript protocol client and types. The cost is a few dozen lines of Kotlin for UnifiedPush and routing network calls through native plugins. **B is the fallback** if Tauri on Android disappoints in the first phase: it's the most mature, but the UI gets redrawn by hand. I'd drop C.

## Stack (option A)
- **UI:** React 19, Vite, TypeScript, Tailwind v4, shadcn/ui with Zoetrik `theme.css` used as-is. Fonts are bundled locally rather than loaded from Google. react-markdown, remark-gfm and Shiki for markdown and code, and a diff viewer for file edits.
- **State:** Zustand for live chat state, TanStack Query for REST data (cron, session search, usage).
- **Transport:** a TypeScript JSON-RPC client modelled on Hermes `apps/shared`, running over `@tauri-apps/plugin-websocket`. REST goes through `@tauri-apps/plugin-http`. Auth: `POST /auth/password-login`, then `ws-ticket`, then `/api/ws?ticket=`. Reconnecting uses `session.events.since`, which feeds the "reconnecting" banner. Attachments use `image.attach_bytes` and `file.attach`.
- **Storage:** only the login (the refresh token, or the username and password) goes in the OS keystore. Nothing else is saved, since the app is online-only.
- **Notifications:** on Android, a Kotlin plugin uses the UnifiedPush connector with ntfy on devbox as the distributor. It posts notifications under the Hermes Bots name and icon even when the app is closed. On Windows, the app sits in the tray, keeps the socket open, and shows its own toasts.
- **Build/CI:** cloud agents build and test the web layer and the APK on Linux. GitHub Actions on `windows-latest` builds the NSIS `-setup.exe` with tauri-action and also publishes the APK. Free private repos get 2,000 Actions minutes a month, and Windows minutes count double ([billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)), so this stays free with the spending limit at $0. Updates: the Tauri updater on Windows, and an "update available" check plus APK download from devbox on Android.
- **Testing:** Vitest with React Testing Library; Playwright against the web build using a fake Hermes JSON-RPC server built from the OpenRPC contract; `cargo test` for Rust glue; a short manual check on your phone and PC after each feature.

## Risks and how we handle them
1. **Notifications beyond routines need a small helper on devbox.** This is the only new server piece, and the reason is that Hermes's 9119 API has no push. It would be a tiny Tailscale-bound service under `~/bots/software-factory` with very little memory use. It logs in to Hermes, watches for approvals, questions, finished replies and errors, and posts to ntfy. Routines use Hermes's built-in ntfy delivery instead. Phase 0 checks whether one watcher socket can see events from every session. If Hermes turns out to have a hook that covers this, we skip the helper.
2. **ntfy on Android wants HTTPS.** Serve ntfy on devbox through `tailscale serve` (free ts.net certificate) and allow anonymous writes only to `up*` topics ([ntfy UnifiedPush](https://unifiedpush.org/users/distributors/ntfy/)).
3. **Hermes runs plain HTTP on the Tailscale IP.** Android blocks plain HTTP by default, so we allow it for that one host only. Tailscale already encrypts the traffic.
4. **Login lifetime.** The refresh token lasts 30 days, after which you log in again with your username pre-filled, as you asked. If Hermes's `basic_auth.secret` isn't set, every Hermes restart logs you out. That setting lives in the Hermes home, so I'd ask Hermes Migration rather than touch it.
5. **Tauri on Android is younger and the secure-storage plugin is community-made.** Phase 0 proves login, the socket, push and storage on your phone before any UI work. If storage disappoints, we write our own ~50 lines of Kotlin plus the `keyring` crate. If Tauri on Android fails outright, we switch to Flutter (option B) before much has been built.
6. **Hermes protocol changes between versions.** We pin to v0.22.5's generated contract and run contract tests against it.

## Build order toward v1 (chat on phone and Windows, plus notifications)
0. **Spike (approval gate):** a bare Tauri app on your phone and PC that logs in, opens the socket, sends one prompt, stores the login, and receives one test push through ntfy. The notifier watcher check happens here too.
1. **App shell + Zoetrik:** sidebar of bots (Junior pinned on top), WhatsApp-style navigation on phone, system light/dark, reconnecting banner.
2. **Core chat:** sessions, send/stop/steer/queue/retry, markdown, code, copy, diffs, todo list, model and reasoning switch, per-reply tokens and cost.
3. **Cards and input:** approval and clarifying-question cards, the global "needs you" list, attachments and pasted images, slash-command menu.
4. **Notifications:** UnifiedPush plugin, notifier helper, Windows tray and toasts. **v1 is done here.**
5. **Rest of the must-haves:** routines (REST cron, posting into the bot's main chat), multi-bot rooms, usage dashboard, history actions, custom avatars, updater.
6. **Later:** streaming text, live tool and sub-agent activity, thinking display.

You review a preview, screenshots or a recording after each phase.

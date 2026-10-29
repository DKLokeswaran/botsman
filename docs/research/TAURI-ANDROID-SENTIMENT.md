# Tauri v2 on Android: what people say (checked 28 Oct 2026)

## 1. Overall sentiment
Tauri works on Android, but most people don't treat it as production-ready. A typical 2025–26 comparison sums it up: "Mobile: Flutter wins… Tauri mobile is still beta" [7]. Tauri's own team said at 2.0: "We are not completely happy about the developer experience" on mobile, and some official plugins don't support mobile [6]. The 2.12 release (Sep 2026) still spent its mobile work on basics: dev-server loading and Gradle 9 / targetSdk 37 templates [8].

Real apps exist, but they are few. The clearest one is a run-coaching app on iOS and Android (r/tauri, Sep 2025) [1]. Its developer says it works "for my use case", but he had to write JNI bridges, patch Tauri itself, and hand-wire RevenueCat. In a June 2026 thread asking why Tauri apps skip Android, the top answer was that Android "doubles the stuff you have to maintain". Another reply called Tauri mobile "heavy and laggy… a high number of elements will kill its performance" [2].

GitHub (counted today): **91 open Android issues in the core repo (66 bugs)** and **37 in plugins**. Several are 2–3 years old. The issues get few reactions, which itself points to a small user base.

## 2. Recurring Android pain points
- **Keyboard and IME:** the keyboard sometimes covers the input and sometimes resizes the view. The bug (#7868) has been open since 2023, and its one-line fix PR (#13277) is still unmerged after 18 months. The usual workaround, `adjustResize`, stops working at targetSdk 35+ (Android 15 edge-to-edge), so you need a custom Kotlin insets fix [3][4]. **This hits a chat input bar directly.**
- **Notifications plugin:** issue #2341 is titled "Absolutely broken plugin in V2" (Android, Jan 2025, still open). Scheduled notifications also break (#3550, Aug 2026) [9].
- **Files and pickers:** the dialog promise doesn't resolve the first time (#3366, Mar 2026). Writing to a `content://` URI leaves a 0-byte file (#3356). The picker loses the real filename (#3029). Clipboard `readImage` isn't supported on Android [9][10].
- **Background and push:** nothing official. You need a community foreground-service plugin or your own Kotlin code [11].
- **WebView:** depends on the device's Chromium WebView version. It is slower than Chrome, and the GeckoView request has been open since 2024 [5].
- **Build and debugging:** slow builds (4 Rust targets by default), manual signing, `android dev` hangs, Rust logs missing (#15142), NDK setup errors [12].
- **Secure storage:** Stronghold is deprecated (Jul 2026), so only community keystore plugins remain.

## 3. Custom Kotlin plugins
Writing your own Kotlin plugin is the normal path; Tauri expects it [6]. But anything beyond basic features takes several of them, and fixes like the keyboard insets are patches on top of Tauri's own Activity. **Your "band-aid over band-aid" worry is fair** for anything that has to run in the background or with the screen off.

## 4. Fit for Hermes Bots
On Android, every hard feature in our app falls in a weak area: a persistent WebSocket plus UnifiedPush in the background (custom Kotlin), notifications (a buggy plugin), a bottom input bar on Android 15 (the keyboard bug), pasted images (no clipboard image support), and secure login storage (community plugin only). Markdown and chat UI are where Tauri is strong, but that's the easy part.

## 5. Flutter check (Windows + Android)
- **Android:** mature. Each of our needs has a maintained package: `unifiedpush` (official), `flutter_secure_storage`, `flutter_local_notifications`, `image_picker`, `web_socket_channel`.
- **Windows:** works in production, but plugin gaps show up (e.g. no official video player on Windows) and need small per-platform fixes [13].
- **Stewardship:** since May 2026, Canonical leads Flutter desktop maintenance [14]. Some people worry Linux will get priority over Windows.
- **Community:** the "Flutter is dying" worry hangs around, but Google's 2026 roadmap continues [15].
- **Costs:** no reuse of the Zoetrik CSS (we'd port the theme tokens to a Flutter theme), and Windows builds need Windows CI (MSI needs it with Tauri too).

## 6. Updated recommendation
**Switch to Flutter.** Confidence: **medium-high (~70%)**.
Reason: our app's hard parts are Android-native features, where Flutter has maintained packages and Tauri needs custom Kotlin patches.
Keep Phase 0 as a quick Flutter spike: Windows build, WebSocket ticket login, and a UnifiedPush notification on your phone.

## Links
1. https://www.reddit.com/r/tauri/comments/1nhhomo/ (Sep 2025)
2. https://www.reddit.com/r/tauri/comments/1ufel9m/ (Jun 2026)
3. https://github.com/tauri-apps/tauri/issues/7868 · https://github.com/tauri-apps/tauri/pull/13277
4. https://github.com/tauri-apps/tauri/issues/10631 · https://stackoverflow.com/questions/79177674
5. https://github.com/tauri-apps/wry/issues/1162 · https://v2.tauri.app/reference/webview-versions/
6. https://v2.tauri.app/blog/tauri-20/ (Oct 2024)
7. https://rustify.rs/articles/rust-tauri-vs-flutter-2026
8. https://v2.tauri.app/blog/tauri-2.12/ (Sep 2026)
9. https://github.com/tauri-apps/plugins-workspace/issues/2341 · /3550 · /3366 · /3356
10. https://github.com/tauri-apps/plugins-workspace/issues/3029 · https://v2.tauri.app/reference/javascript/clipboard-manager/
11. https://github.com/dardourimohamed/tauri-background-service
12. https://github.com/tauri-apps/tauri/issues/15273 (Apr 2026) · /15142 · /11108 · /11841
13. https://oxisoft.io/blog/flutter-desktop-in-production/ (Oct 2026)
14. https://www.omgubuntu.co.uk/2026/05/flutter-desktop-canonical-maintained
15. https://flutter.dev/blog/flutter-darts-2026-roadmap
Other threads: r/tauri "Tauri is unsuitable for mobile" https://www.reddit.com/r/tauri/comments/1maezph/ · HN Tauri 2.0 https://news.ycombinator.com/item?id=41721996

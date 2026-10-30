# Windows-first plan: Tauri on Windows + native Kotlin on Android (28 Oct 2026)

Research only. Reddit points come from search excerpts (direct fetches are blocked). GitHub counts are live as of 28 Oct 2026.

## 1. Tauri v2 on Windows
- **Sentiment:** Windows is Tauri's strongest platform. WebView2 is "the only competent one" of the three webviews (X, Oct 2026). Shipping on it: Epic Games launcher (per an X binary analysis, Oct 2026), Fluxzy (moved from Electron Dec 2025, installer 190→55 MB), lencx/ChatGPT and Pake.
- **Issues:** 128 open Windows issues in core (96 bugs, **2 P1, 0 crash-level**) and 22 in plugins. The most-upvoted are installer requests and antivirus false positives (#2486), not broken basics.
- **Pain points:**
  - **Signing:** Windows 11 Smart App Control blocks unsigned apps, and since 2024 no certificate type gets instant SmartScreen trust.
  - **Toasts:** they need the app's Windows ID (AUMID) registered at install. When that slips, toasts fail silently, so one team re-registers it at every startup (whatRust PR, 2026).
  - **Memory:** 200–400 MB is normal (r/tauri, Jan 2026). The webview can also run out of memory when left in the background for long (#13758, still open).
  - **IME:** two open CJK bugs (May and Oct 2026). Nothing reported for Tamil/Hindi; WebView2 handles them the way Edge does.
  - **Other bugs:** the clipboard plugin crashes when Win+V is opened (#3415), and autostart can disappear after one boot (#771).
  - **Fine:** saved login (Credential Manager via a keyring plugin), tray, single instance, updater, high-DPI, drag-and-drop, WebSocket.
- **Custom Rust code:** small and occasional, not constant patching.
- **Compared with the alternatives:** Tauri has better Windows quality than Flutter (new-renderer memory regressions, single-maintainer tray plugin) and than Compose Desktop (Java runtime size, basic tray and toasts).

## 2. Native Kotlin + Compose on Android
First-class, with no band-aids.
- **Background:** the app keeps its own connection in a foreground service. Android 15 caps `dataSync` services at 6 hours a day, so the service uses the `specialUse` type. ntfy is an optional alternative.
- **Keyboard with a bottom composer:** one `imePadding` under edge-to-edge.
- **Markdown:** mikepenz renderer 0.46.0 (Oct 2026), streaming-capable. Markwon is dead.
- Pickers, pasted images, notifications and Keystore are standard platform APIs.

## 3. Cost of two apps
Every feature gets built twice, and the apps drift apart. Ways to keep them in sync:
- one OpenRPC/JSON-Schema contract that generates both the TS and Kotlin clients
- shared contract tests run against a recorded mock of Hermes
- design tokens generated from one source (Style Dictionary)
- a feature-parity checklist on every PR

**A shared Rust (UniFFI) or Kotlin Multiplatform core isn't worth it.** Our core is a thin JSON-RPC client, and sharing it would add Android native builds and a second build system.

## 4. Alternatives
- **Compose Multiplatform:** one codebase, native-quality Android, the weakest Windows. It's the fallback if keeping two apps in sync proves too costly.
- **Flutter:** solid on Android, middling on Windows.

## 5. Recommendation
**Tauri v2 on Windows + native Kotlin/Compose on Android, about 75% confident.** Each platform gets its strongest tool with no core band-aids; the cost is doing the work twice, which can be managed.

**Top 3 risks:**
1. The two apps drifting apart.
2. Windows signing and toast registration.
3. Android background delivery depends on the foreground service staying alive, which some phone makers' app killers interfere with.

## Links
- Tauri signing / Smart App Control: https://v2.tauri.app/distribute/sign/windows/
- Tauri toast actions (Windows limits): https://v2.tauri.app/reference/javascript/notification/
- AUMID toast fix (2026): https://github.com/karem505/whatRust/pull/4
- Tauri out of memory #13758 (2025–26): https://github.com/tauri-apps/tauri/issues/13758
- Tauri IME #15436 (May 2026): https://github.com/tauri-apps/tauri/issues/15436 ; #16391 (Oct 2026): https://github.com/tauri-apps/tauri/issues/16391
- Antivirus false positives #2486: https://github.com/tauri-apps/tauri/issues/2486
- Clipboard Win+V crash #3415 (May 2026): https://github.com/tauri-apps/plugins-workspace/issues/3415 ; autostart #771: https://github.com/tauri-apps/plugins-workspace/issues/771
- Stronghold deprecation: https://github.com/tauri-apps/plugins-workspace/issues/3494 ; tauri-plugin-secure-storage: https://crates.io/crates/tauri-plugin-secure-storage
- r/tauri "Is Tauri a memory hog" (Jan 2026): web-search excerpt only, no fetched URL
- Fluxzy Electron→Tauri (2026): https://www.fluxzy.io/resources/blogs/electron-to-tauri-migration-fluxzy-desktop
- X (public search): @meowybnuuy on Epic launcher using Tauri+WebView2 (14 Oct 2026, 284 likes); @Yay_Yow "WebView2 … the only competent one" (23 Oct 2026); @Aduneer SmartScreen on unsigned Tauri app (20 Oct 2026)
- Android 15 FGS timeout: https://developer.android.com/about/versions/15/behavior-changes-15 ; OpenClaw fix: https://github.com/openclaw/openclaw/pull/80082
- Compose edge-to-edge/IME: https://developer.android.com/develop/ui/compose/system/setup-e2e
- Markdown renderer: https://github.com/mikepenz/multiplatform-markdown-renderer/releases ; Markwon unmaintained: https://github.com/noties/Markwon/issues/460

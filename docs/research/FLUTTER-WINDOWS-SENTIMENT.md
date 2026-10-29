# Flutter on Windows desktop: honest sentiment check (28 Oct 2026)

Reddit blocks direct fetches, so the Reddit points come from search excerpts. GitHub counts are live as of 28 Oct 2026.

## 1. Overall
**Usable in production, with rough edges.** That's better than Tauri Android. There are 446 open Windows issues, but only **2 are P1** (Android has 1,679 open). Real apps ship on it: RustDesk, AppFlowy, LocalSend, LucidClip (Apr 2026) and OxiType (Oct 2026). A Flutter team member adds Google apps and the Universal Studios kiosks, though he isn't neutral. Firebase still says Windows is "not for production". Canonical took over desktop in May 2026, so the open question is how much it prioritises Windows.

## 2. Pain points
- **Text:** soft text (no ClearType, #63043, open since 2020) was the classic complaint. Flutter 3.47 (Aug 2026) "made Windows text look ridiculously good" (r/FlutterDev).
- **New renderer regressions:** 3.47 made Impeller the default renderer. Since then, **14 new Windows Impeller issues**, including RAM going from 100 MB to 450 MB (#191497), freezes while resizing and slow scrolling. A one-line switch back to the old renderer exists, but Flutter says it "will be removed in a future release". This is the newest band-aid risk.
- **IME:** Chinese input dies after the window regains focus (#190042, Jul 2026). It was closed unresolved. I found **no data on Tamil or Hindi input**, so we must test it ourselves.
- **Tray and window control:** the `window_manager` and `tray_manager` plugins come from one person. In Oct 2025 he said the new windowing API makes window_manager "unusable" and he'd "abandon" it. His replacement isn't "production-ready", and he's "Frustrated with the state of Flutter's desktop ecosystem" (May 2026). He still released tray_manager 0.8.0 in Oct 2026. **This is the biggest risk to the core app.**
- **Toasts, saved login, single instance, installer:** all actively maintained in 2026. Auto-update (`auto_updater`) is stale (2024).
- **Long chats:** selecting text within one message works. Selecting across the whole chat list is fragile, so the usual pattern is a per-message "Select & copy" view.
- Multi-window is still experimental, and keyboard shortcuts draw complaints. The webview and video gaps are covered in FLUTTER-FUTURE-FEATURES.md.

## 3. Custom C++ code
Shipping teams call it **normal**: "a handful of short, well-marked spots… finding them is the real cost" (OxiSoft). The exception is the tray and window layer, which is being rebuilt from scratch.

## 4. Our app
- **Fine:** WebSocket, toasts, saved login, single instance, markdown and code, pasted images.
- **Watch:** the tray library's future, Impeller memory use, Indian-language input, and copying long messages.

## 5. Band-aid risk compared
- **Tauri:** the Android core is broken.
- **Flutter:** the core app works on both platforms. Tray, renderer and IME on Windows are moderate risks.
- **Compose Multiplatform:** the honest dark horse. Android is first-class, and 2026 desktop sentiment is positive ("genuinely production-ready", "very stable"). Costs: JVM size and RAM, basic tray and toast support, painful packaging, and less AI training data than Flutter.
- **.NET MAUI:** negative 2026 sentiment. Skip it.
- **Two native apps:** no band-aids, but double the code.

## 6. Recommendation
**Flutter, about 60% confident (down from 70%).** It's the only option where the core app works on both platforms without patches. Before locking, run a 2-day Windows test of tray, toasts, Tamil/Hindi typing, long-message copy and Impeller RAM. If the tray or IME test fails, switch to Compose Multiplatform.

## Links
- r/FlutterDev 3.47 text (Aug 2026): https://www.reddit.com/r/FlutterDev/comments/1vms16w/
- r/FlutterDev production thread (2026): https://www.reddit.com/r/FlutterDev/comments/1tcsn86/
- r/FlutterDev Firebase/Windows: https://www.reddit.com/r/FlutterDev/comments/1pnw4wf/
- r/flutterhelp "not as smooth": https://www.reddit.com/r/flutterhelp/comments/1q3uhe5/
- OxiSoft post-mortem (15 Oct 2026): https://oxisoft.io/blog/flutter-desktop-in-production/
- Flutter 3.47 (Impeller default, Skia switch going away): https://flutter.dev/blog/whats-new-in-flutter-3-47
- Flutter 3.44 / Canonical (May 2026): https://flutter.dev/blog/whats-new-in-flutter-3-44 , https://www.omgubuntu.co.uk/2026/05/flutter-desktop-canonical-maintained
- Impeller RAM #191497: https://github.com/flutter/flutter/issues/191497 ; IME #190042: https://github.com/flutter/flutter/issues/190042 ; ClearType #63043: https://github.com/flutter/flutter/issues/63043
- window_manager author on abandoning it (Oct 2025): https://x.com/lijy91/status/1981873046739894580 ; on nativeapi (May 2026): https://x.com/lijy91/status/2057280851139002618 , https://x.com/lijy91/status/2051648738201067614
- Loïc Sharma on who ships (Jan 2026): https://x.com/LoicSharma/status/2015511275112157203
- LucidClip (Apr 2026): https://x.com/enthusiastDev/status/2044443366801207353
- Selection pattern: https://github.com/cuplivo/cuplivo/blob/47b6ae65/CONTEXT.md
- CMP: https://www.reddit.com/r/JetpackCompose/comments/1se339e/ , https://www.reddit.com/r/Kotlin/comments/1u6v53b/ , https://www.reddit.com/r/androiddev/comments/1sx6qkg/
- MAUI: https://www.reddit.com/r/dotnetMAUI/comments/1tnjpq2/ , https://www.reddit.com/r/dotnetMAUI/comments/1vjyyjn/

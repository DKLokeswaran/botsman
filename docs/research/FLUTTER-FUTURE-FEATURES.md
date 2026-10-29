# Flutter for future features: Windows + Android (checked 28 Oct 2026)
Versions and dates come from pub.dev and the GitHub API, read today. "Both" means one package that supports both Windows and Android.

**1. Video.** The official `video_player` 2.14.1 (2 Oct 2026) has **no Windows support**.
- **`fvp`** 0.39.1 (15 Oct 2026; 367★, 82 open issues) plugs Windows into the same `video_player` code. It's active and is the best choice.
- `video_player_win` 3.3.1 (14 Oct 2026) is Windows-only and small (43★).
- `media_kit` (1.8k★, 364 open issues) is officially in **"Limited Maintenance"** (#1337, Nov 2025). Its last release was Dec 2025, and users asked "is it still maintained?" in Oct 2026 (#1456). Avoid it as the base.
- Verdict: works, but through a community package on Windows.

**2. Audio + voice recording.**
- **`record`** 7.1.2 (9 Oct 2026; 6 open issues, Windows part updated Sep 2026): first-class on both.
- `audioplayers` 6.8.1 (Jun 2026): both.
- `just_audio`: its Windows add-on had crash bugs that were only fixed in Apr 2026.
- Verdict: solid.

**3. Embedded web (link previews, HTML "Pages" canvas).** This is Flutter's weak spot.
- The official `webview_flutter` has **no Windows support**. It is blocked on a Flutter engine feature (#31713, open since 2019). In Jan 2026 the maintainer said "priorities changed, and that work stopped."
- `flutter_inappwebview` (3.8k★, 227 open issues) supports Windows, but only in a beta (6.2.0-beta.3, Feb 2026). The last stable was Oct 2024.
- Its Windows method draws the web page into a captured image of a hidden window. That means **high GPU use and focus glitches** (#2387; WebView2Feedback #4944, still open Jul 2026).
- `webview_windows` has had no release since Feb 2024.
- Link previews are fine without a webview (`any_link_preview`).
- Verdict: works, but it's a workaround.

**4. PDF, images, big markdown and code.**
- **`pdfrx`** 2.10.1 (23 Oct 2026): both, active. Syncfusion's PDF viewer also works but has a commercial licence.
- `photo_view` (image viewer): both, but its last release was Apr 2024.
- `gpt_markdown` 1.4.0 (21 Oct 2026) renders markdown in chunks while text streams in. `re_editor` handles large code.
- Verdict: good.

**5. Drag-and-drop and clipboard on Windows.**
- **`desktop_drop`** (20 Oct 2026) and **`pasteboard`** (22 Oct 2026, handles pasted images), both from the Mixin team: active.
- `super_clipboard` / `super_drag_and_drop`: last release Jun 2025.
- Verdict: good.

**6. Streaming text.** Fine, but only with the right design:
- Group incoming tokens and redraw once per frame.
- Re-parse only the last markdown block as text arrives.
- Use lazily built lists.

Benchmarks: re-parsing the whole message on every token gets quadratically slower; on a 7 KB reply that was 899 ms of parsing (mings.in). The talon project's issue #1059 is a real-world example of the same mistakes. Put these rules into the agent spec.

## Verdict vs Tauri
- **Tauri on Windows** is naturally better for video, web content and PDF, because they run in a real browser engine.
- **Flutter on Windows** covers video (fvp), audio, PDF, drag-and-drop, clipboard and markdown with active packages. Only **embedded web content** is a real workaround.
- **Tauri on Android** has its weak spots (keyboard, notifications, background, pickers) in the *core* app, today.
- Flutter's weak spot is an *optional future* feature. If we need "Pages", it can live in its own screen, or open in the browser, instead of sitting inline in chat.

**Still Flutter.** Confidence: **medium-high (~70%)**. Revisit if embedded HTML ever becomes central to the app.

## Links
- fvp https://pub.dev/packages/fvp · video_player https://pub.dev/packages/video_player · media_kit https://github.com/media-kit/media-kit/issues/1337 and /issues/1456
- record https://pub.dev/packages/record · just_audio_windows https://github.com/bdlukaa/just_audio_windows/issues/53
- webview_flutter Windows https://github.com/flutter/flutter/issues/37597 and https://github.com/flutter/flutter/issues/31713 · inappwebview https://github.com/pichillilorenzo/flutter_inappwebview/releases and /issues/2387 · https://github.com/MicrosoftEdge/WebView2Feedback/issues/4944
- pdfrx https://pub.dev/packages/pdfrx · gpt_markdown https://github.com/useval/gpt_markdown/blob/main/docs/streaming.md
- desktop_drop https://pub.dev/packages/desktop_drop · pasteboard https://pub.dev/packages/pasteboard
- streaming https://mings.in/en/posts/flutter-stream/ · https://github.com/thefalconry/talon/issues/1059

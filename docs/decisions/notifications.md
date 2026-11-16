# Alerts when the apps are closed

While an app is open, its screens use their own WebSocket. Alerts need something that keeps running when the UI doesn't.

## Android

The default is a small Kotlin foreground service that holds an alerts WebSocket. UnifiedPush comes after v1, as a second option.

| | Foreground service | UnifiedPush |
| --- | --- | --- |
| User effort | Install and sign in | Install a distributor such as ntfy, pick it, and usually exempt it from battery limits |
| Permanent notification | In our app | Usually yes, in ntfy's app |
| Server work | None beyond the alerts stream | A sender, and a ntfy server if self-hosting |
| Google Play | Needs a declaration and review | Nothing to declare for this |

The foreground service wins on effort, and it needs no third party. ntfy's own instant delivery runs on a foreground service with a permanent notification, so UnifiedPush mostly moves the notification to another app.

FCM isn't used. A self-hosted server can't push to a published app without the app's Firebase key, so each self-hoster would need their own Firebase project and app build.

### Service details

- Type `specialUse`. Android 15's ban on starting foreground services at boot doesn't list it, and its 6-hour limit applies to `dataSync` and `mediaProcessing`.
- It restarts after a reboot, through a boot receiver.
- After any reconnect, it catches up on missed alerts, so a killed service delays alerts rather than losing them.
- The ntfy author measured 0 to 1% battery over 17 hours for a similar connection, on one phone.

### Phone makers

Pixel, Nokia, and HTC are rated best by dontkillmyapp.com, and Xiaomi, OnePlus, Huawei, and Samsung worst. Samsung promised in 2024 to honour foreground services on One UI 6 and later, which is unverified. For the worst brands, the site lists no solution on the developer's side, so users have to change settings. The app links to the steps for the phone's brand.

### Google Play

Botsman installs as a direct APK for now, so none of this applies yet. For a Play release:

- Apps targeting Android 14 or later must declare each foreground service type in Play Console. A `specialUse` service also explains its use in the manifest, and reviewers read that.
- A service must be core to the app, started by the user or visible to them, stoppable, and impossible to defer without harm. It must also run "only for as long as necessary", which is the hard rule for an always-on connection.
- A "Keep connected in background" setting helps meet the rest.

If Play rejects it, the Play build ships with UnifiedPush only, and other builds keep the service. Both sit behind one interface for this reason.

## Windows

The alerts socket runs in Tauri's Rust side, and the tray shows notifications. Tauri's `backgroundThrottling` setting doesn't work on Windows, and reports disagree on whether a hidden WebView2 window gets throttled. Rust avoids the question.

## Web dashboard

The open page's WebSocket carries alerts, and the browser shows them as notifications after the owner allows them once. Notifications arrive only while the site is open in a tab. Nothing arrives after the tab closes.

The page follows the alerts stream through `client-core` and shows a notification only while it isn't in front, since the page itself already shows what needs the owner. A click brings the page forward on that bot's chat. Settings asks for the browser's permission with a Turn on button, and says when the browser has blocked it.

## Alert settings

The owner turns each alert type on or off in the apps. The server stores these settings, so one choice applies to every device. The server leaves a type that is off out of the alerts stream. This follows the rule that state lives on the server.

Every type starts on. The settings live in `server.db`, are read and changed at `/api/settings/alerts`, and reach every open app through the `server` stream. An alert that was off when it happened is not sent later when the type is turned back on.

## Alert content

The alerts stream carries the bot and the event. The app fetches message content from the server. When UnifiedPush arrives, a push will carry only an ID, so no chat text passes through a third-party server.

## Sources

- [Google Play: foreground service requirements](https://support.google.com/googleplay/android-developer/answer/16559646?hl=en)
- [Android: foreground service types](https://developer.android.com/develop/background-work/services/fgs/service-types)
- [Android 15 behaviour changes](https://developer.android.com/about/versions/15/behavior-changes-15)
- [dontkillmyapp.com](https://dontkillmyapp.com/) and its [Samsung page](https://dontkillmyapp.com/samsung)
- [ntfy phone docs](https://docs.ntfy.sh/subscribe/phone) and [FAQ](https://docs.ntfy.sh/faq/)
- [Tauri config reference](https://v2.tauri.app/reference/config/)

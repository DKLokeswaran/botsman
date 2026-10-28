# Phase 0 device checklist

The apps are test builds. They are unsigned. Nothing in the repo contains your Hermes password. Type it on the device.

Default server URL, already filled in:

`http://100.113.35.96:9119`

That is the Tailscale address Hermes is bound to. The MagicDNS name `devbox.tail2eeb02.ts.net` is rejected. Hermes answers `POST /auth/password-login` with HTTP 400 and `detail` `Invalid Host header. Dashboard requests must use the bound hostname or the configured public hostname.` If the box still shows the MagicDNS name, replace it with the IP. A saved copy of that old default is replaced on the next launch.

The phone and the PC both need to be on your tailnet. Hermes must be running and bound to `100.113.35.96`, not only to localhost. A failed login or refresh shows the HTTP status and Hermes's `detail`, for example `Login failed (401: Invalid credentials)`. A network or permission failure shows the reason and the URL that was tried. The password, cookies, and tokens are not shown.

## Get the builds

On the pull request, open Checks.

- Android: the Ubuntu job uploads an artifact named `hermes-bots-android-debug`. Download it and unzip. The file is `app-debug.apk`.
- Windows: the Windows job uploads an artifact named `hermes-bots-windows-setup`. Download it and unzip. The file ends in `-setup.exe`.

If a job is still running, wait until it is green. If the Windows job failed, do not install a leftover exe from somewhere else.

### Windows 11 and the unsigned installer

The installer is not signed. There is no certificate. Signing is a later task.

SmartScreen will say Windows protected your PC, or that the publisher is unknown. Choose **More info**, then **Run anyway**.

Smart App Control, if it is set to On, can block the app even after that. For this test, Smart App Control has to be in Evaluation or Off. Turning it Off is a one-way choice on some PCs: Windows will not let you turn it back On without reinstalling. If you do not want to change it, stop at this step and say so. Do not disable other security products for this test.

The installer is per-user. It should not ask for an administrator password. WebView2 is already on Windows 11. If a first toast does nothing, install the app with this exe and try again from the installed copy. Toasts are registered for the installed app id `com.hermesbots.phase0`.

### Android and the debug APK

The APK is a debug build, not a Play Store build.

1. Copy `app-debug.apk` onto the phone.
2. Open the file. If Android asks, allow that app (Files, Chrome, or Drive) to install unknown apps.
3. Tap Install. The name is Hermes Bots.
4. If a previous debug build is installed and Android refuses the update, uninstall that copy first. There is no saved login to keep. The password was never stored.

Play Protect may warn that the app is unknown. That is expected for a debug APK sideloaded from GitHub.

## Windows checklist

1. Install from the exe. Open Hermes Bots. The window title is Hermes Bots.
2. Leave the server URL, or correct it if the host changed. Type your username and password. Tap **Log in**.
   - The status line should become **Connected**.
   - Profiles from Hermes should be listed, then sessions.
3. Close the window with the X. The process should stay running. The tray icon is still there. Left-click it, or choose **Open**, and the window comes back. **Quit** on the tray menu exits.
4. Open the app a second time from the Start menu while it is already running. It should focus the existing window, not start a second one.
5. Quit from the tray. Open the app again. It should sign in by itself, without asking for the password. The status becomes **Connected**.
6. On the server, restart Hermes if you can, or wait out the access token. The next launch should show **Sign in again** followed by the refresh failure, with your username already filled in, and an empty password. (A normal restart of the app alone should still auto-login. Forced expiry is the case that prefills the username.)
7. Tap a session. The transcript appears. Type a short prompt in the bottom box and tap **Send**. Your line shows, then the reply. A reply that contains a short markdown list and a code fence should show bullets (or numbers), and the fence should have a language label, a **Copy** button that changes to **Copied**, and colored syntax. A long user message collapses after about six lines, with **Show more**.
8. Ask Hermes to run something that needs approval, for example a terminal command. One card titled **Needs you** appears at the bottom of the conversation, and the view scrolls to it. It has **Allow once** and **Deny**. Tap one. The card collapses to the choice (**Allowed once** or **Denied**) and that line disappears after about five seconds, or sooner when another message arrives. Hermes continues or stops according to the tap. **Full command** shows the command text. If the same card is still open on the phone and you answer there, this window first says **Answered on another device**. A denied command changes that line to **Denied on another device**. A command that runs changes it to **Approved on another device**. The line stays in this session only. A message sent from the phone shows up here without switching sessions. After a reconnect, a card you already answered does not come back.
9. Turn the tailnet off, or stop Hermes, while the app is open. A **Reconnecting** banner appears. Turn the network back. The banner goes away and the status returns to **Connected**. Send another prompt. The reply still arrives. Lines that finished while you were away show up again.
10. Click the message box and paste a screenshot (a copied image). A thumbnail appears above the box. The image is not uploaded. Tap **Attach file**, pick a small file, and its name appears. An image file also shows a thumbnail.
11. Click **Try Tamil and Hindi typing here**. Switch the Windows keyboard to Tamil, type a few letters, then Hindi. The characters should appear as you type.
12. Tap **Autostart off**. It should flip to **Autostart on**. Sign out of Windows and sign back in. Hermes Bots should start. Flip it off again if you do not want that left on.
13. Tap **Send test toast**. A Windows toast titled Hermes Bots should appear. Then minimise the window, or close it to the tray, and send a prompt from another client (or wait for a reply). A toast should appear for that reply or for an approval. Click the toast while it is still on screen. The window comes back on that session, and the approval card or the reply is outlined. If the toast has already moved to Action Center, Windows does not report the click: use the tray **Open** item, which opens the same session.

## Android checklist

1. Install the debug APK and open Hermes Bots.
2. Allow notifications when Android asks.
3. On the login screen, tap **Register push**. If ntfy is installed, the status should move to registering and then show an endpoint URL in green. Leave that screen up long enough for the endpoint to appear. If ntfy is not installed, the status says to install it. Install ntfy from F-Droid or the Play Store, open ntfy once so it can be a distributor, come back, and tap **Register push** again.
4. Type the server URL if it is not already right. Type your username and password. Tap **Log in**. Status becomes **Connected**. Profiles and sessions are listed.
5. Force-stop the app from Android settings. Open it again. It should sign in by itself.
6. To check expiry: on the server, restart Hermes if your dashboard secret is unset (that kills the session), or wait until the refresh token is rejected. Open the app. The username is filled in, the password is empty, and the status starts with **Sign in again** and includes the refresh failure.
7. Tap a session. Send a prompt. The reply renders. A markdown list shows a marker on each item. A code fence shows the language, a **Copy** button that changes to **Copied**, and colored syntax. A long user message collapses after about six lines, with **Show more**.
8. Trigger an approval. One card appears at the bottom of the conversation, and the view scrolls to it. Tap **Allow once** or **Deny**. The card collapses to that choice and the line disappears after about five seconds, or sooner when another message arrives. The notification **Allow once** and **Deny** actions do the same. Answer the same card from Windows instead, and this phone first says **Answered on another device**, then **Denied on another device** or **Approved on another device** once the tool result arrives. The line does not show in a different chat. A message sent from Windows shows up here without switching sessions. A reconnect does not bring a finished card back.
9. Toggle airplane mode, or disconnect Tailscale, while a session is open. **Reconnecting** shows. Restore the network. The banner clears. A prompt still works, and anything that finished during the gap is filled in.
10. Focus the message field and open the keyboard. The composer is one row: an attach icon, the message field, and a send icon. It fits the screen width with no sideways scroll, and it stays above the keyboard. The system bars are edge to edge. The field **Try Tamil and Hindi typing here** is at the bottom. Switch the keyboard to Tamil, type, then Hindi. The characters appear.
11. Tap the attach icon. **Image**, **File**, and **Paste image** are in that menu. Paste or pick an image and a thumbnail appears. Pick any other file and its name appears. Nothing is uploaded.
12. Let the notifier deliver an approval (or POST a JSON body with `kind`, `session_id`, and `request_id` to the endpoint). The notification uses the Approvals channel and has **Allow once** and **Deny**. Tap the notification. The app opens that session and outlines the card. If the request was already answered, the card says **Resolved** and the buttons are gone. **Allow once** or **Deny** on the notification itself answers it when the card is still open. A finished reply uses the Replies channel and opens on that message. A plain text POST, the old notifier shape, still opens the app and shows **Opened from notification**. Android settings can mute Replies without muting Approvals.

## Notifier on the devbox

This is separate from the two apps. See `notifier/README.md`.

1. Copy `notifier.env.example` to `~/.config/hermes-bots/notifier.env` and fill in your Hermes username and password on the machine. Do not commit that file.
2. Set `NOTIFY_URL` to the endpoint from the Android screen, or to an ntfy topic.
3. Set `HERMES_URL` to `http://100.113.35.96:9119` and `BIND_HOST` to `100.113.35.96`. The MagicDNS name is rejected with the same Host-header 400 as the apps.
4. Run it once with `--dry-run`. It should print `logged in` and `socket ready`, and it should not print the password.
5. Open a session in one of the apps and send a prompt that asks for approval. The notifier prints one `NOTIFY` line whose body is JSON (`kind`, `title`, `body`, `session_id`, `profile` when known, `request_id`, and for a reply `message_id` or `seq`). The phone shows that notification if `NOTIFY_URL` is the phone's endpoint. Tapping it opens the session. The notifier does not tap Allow or Deny. No new environment variables. After you copy the new `hermes_notify.py`, restart the process (`systemctl --user restart hermes-bots-notify.service`, or restart the tmux session). Install the new APK with that restart. A new JSON body on the previous APK would show the raw JSON. An old plain-text body on the new APK still opens the app.
6. `curl http://<BIND_HOST>:<BIND_PORT>/health` from another tailnet device returns `ok`. A machine off the tailnet should not reach it.

## What a pass looks like

Each numbered step does the thing in its last sentence. A failure is a wrong status, a missing list, a reply that never arrives, a toast that never shows, a composer hidden under the keyboard, or a password that appears in any log.

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
7. Tap a session. The transcript appears. Type a short prompt in the bottom box and tap **Send**. Your line shows, then the reply. A reply that contains a short markdown list and a code fence should show the list and a monospaced block.
8. Ask Hermes to run something that needs approval, for example a terminal command. A card titled **Needs you** appears, with **Allow once** and **Deny**. Tap one. The card goes away. Hermes continues or stops according to the tap. **Full command** shows the command text.
9. Turn the tailnet off, or stop Hermes, while the app is open. A **Reconnecting** banner appears. Turn the network back. The banner goes away and the status returns to **Connected**. Send another prompt. The reply still arrives. Lines that finished while you were away show up again.
10. Click the message box and paste a screenshot (a copied image). A thumbnail appears above the box. The image is not uploaded. Tap **Attach file**, pick a small file, and its name appears. An image file also shows a thumbnail.
11. Click **Try Tamil and Hindi typing here**. Switch the Windows keyboard to Tamil, type a few letters, then Hindi. The characters should appear as you type.
12. Tap **Autostart off**. It should flip to **Autostart on**. Sign out of Windows and sign back in. Hermes Bots should start. Flip it off again if you do not want that left on.
13. Tap **Send test toast**. A Windows toast titled Hermes Bots should appear. Then minimise the window, or close it to the tray, and send a prompt from another client (or wait for a reply). A toast should appear for that reply or for an approval. Clicking the app from the toast is the system toast click. The tray **Open** item brings the window back.

## Android checklist

1. Install the debug APK and open Hermes Bots.
2. Allow notifications when Android asks.
3. On the login screen, tap **Register push**. If ntfy is installed, the status should move to registering and then show an endpoint URL in green. Leave that screen up long enough for the endpoint to appear. If ntfy is not installed, the status says to install it. Install ntfy from F-Droid or the Play Store, open ntfy once so it can be a distributor, come back, and tap **Register push** again.
4. Type the server URL if it is not already right. Type your username and password. Tap **Log in**. Status becomes **Connected**. Profiles and sessions are listed.
5. Force-stop the app from Android settings. Open it again. It should sign in by itself.
6. To check expiry: on the server, restart Hermes if your dashboard secret is unset (that kills the session), or wait until the refresh token is rejected. Open the app. The username is filled in, the password is empty, and the status starts with **Sign in again** and includes the refresh failure.
7. Tap a session. Send a prompt. The reply renders. A markdown list and a code fence should be readable.
8. Trigger an approval. Tap **Allow once** or **Deny**. The card clears.
9. Toggle airplane mode, or disconnect Tailscale, while a session is open. **Reconnecting** shows. Restore the network. The banner clears. A prompt still works, and anything that finished during the gap is filled in.
10. Focus the message field and open the keyboard. The message box stays above the keyboard, not under it. The system bars are edge to edge. The field **Try Tamil and Hindi typing here** is at the bottom. Switch the keyboard to Tamil, type, then Hindi. The characters appear.
11. Tap **Paste image** after copying an image. A thumbnail appears. Tap **Image** and pick a photo. Tap **File** and pick any file. You see a thumbnail for images and the name for other files. Nothing is uploaded.
12. From a computer, POST a line of text to the endpoint URL shown in the app (or let the notifier do it). A notification titled Hermes Bots appears. Tap it. The app opens and the text is shown as **Opened from notification**.

## Notifier on the devbox

This is separate from the two apps. See `notifier/README.md`.

1. Copy `notifier.env.example` to `~/.config/hermes-bots/notifier.env` and fill in your Hermes username and password on the machine. Do not commit that file.
2. Set `NOTIFY_URL` to the endpoint from the Android screen, or to an ntfy topic.
3. Set `HERMES_URL` to `http://100.113.35.96:9119` and `BIND_HOST` to `100.113.35.96`. The MagicDNS name is rejected with the same Host-header 400 as the apps.
4. Run it once with `--dry-run`. It should print `logged in` and `socket ready`, and it should not print the password.
5. Open a session in one of the apps and send a prompt that asks for approval. The notifier prints a `NOTIFY` line of kind `approval`, and the phone shows a notification if `NOTIFY_URL` is the phone's endpoint. The approval card is still yours to tap in the app. The notifier does not tap Allow or Deny.
6. `curl http://<BIND_HOST>:<BIND_PORT>/health` from another tailnet device returns `ok`. A machine off the tailnet should not reach it.

## What a pass looks like

Each numbered step does the thing in its last sentence. A failure is a wrong status, a missing list, a reply that never arrives, a toast that never shows, a composer hidden under the keyboard, or a password that appears in any log.

# Releasing

Each part has its own version and tag. [Versions and releases](../decisions/stack.md#versions-and-releases) explains why.

## An app

Each app's first release is 0.1.0. Builds made while M2 was tested were removed with their tags, so no installed app is offered one.

1. Set the new version in the app's config file.
   - Android: `version` and `android.versionCode` in `apps/android/app.json`. The version code is `major * 10000 + minor * 100 + patch`, so 0.2.3 is 203.
   - Windows: `version` in `apps/windows/src-tauri/tauri.conf.json`.
2. Commit, and get the commit onto `main`.
3. Tag that commit `android-v<version>` or `windows-v<version>`, and push the tag.

The app's workflow then checks that the tag and the config file agree, builds and signs the app, publishes a GitHub release with the build, and replaces the app's manifest in the `updates` release. Installed apps read that manifest and offer the new build. They check when they connect to the server, again every six hours while open, and whenever the owner presses Check for updates in Settings, which also shows the installed version and when it last checked. A new version brings up an "Update available" dialog with Not now and Install. Not now hides it until a newer version appears, and Settings still offers Install.

`node scripts/release.ts check android android-v0.2.3` runs the same check by hand.

| File in the `updates` release | Read by | Holds |
| --- | --- | --- |
| `android.json` | The Android app | Version, version code, protocol number, the APK's address, and its SHA-256 digest |
| `windows.json` | Tauri's updater in the Windows app | Version, protocol number, the installer's address, and its signature |

An app offers a build only when it is newer than the installed one and the connected server accepts its protocol number.

The Android app asks once for Android's "install unknown apps" permission, then downloads the APK, checks its digest, and hands it to Android's installer, which asks the owner to confirm. On a phone with Google Play Protect, Play Protect may then offer to scan the app; "More details", then "Install without scanning", installs it without sending it to Google, after the phone's lock screen check. The Windows app closes while its installer runs.

## The server and dashboard

Tag the commit `server-v<version>`. Nothing is built. The owner updates with `git pull` and `deploy/install.sh`, as [running the server](server.md#updating) describes.

## Signing keys

| Secret in GitHub Actions | Used for |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` | Signing the APK. Android installs an update only when it carries the same key as the installed app. |
| `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Signing the Windows update. The matching public key is in `tauri.conf.json`. |

GitHub never shows a secret again, so the owner keeps a copy of both keys elsewhere. With a key lost, installed apps can't take another update and must be reinstalled by hand.

A fork uses its own keys, its own public key in `tauri.conf.json`, and its own manifest addresses: `plugins.updater.endpoints` in `tauri.conf.json` and `extra.updateManifestUrl` in `apps/android/app.json`.

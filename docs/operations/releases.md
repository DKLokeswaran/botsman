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

The installed app's version is the one in its config file. A release build never takes any other version.

| File in the `updates` release | Read by | Holds |
| --- | --- | --- |
| `android.json` | The Android app | Version, version code, protocol number, the APK's address, and its SHA-256 digest |
| `windows.json` | Tauri's updater in the Windows app | Version, protocol number, the installer's address, and its signature |

An app offers a build only when it is newer than the installed one and the connected server accepts its protocol number.

The Android app asks once for Android's "install unknown apps" permission, then downloads the APK, checks its digest, and hands it to Android's installer, which asks the owner to confirm. On a phone with Google Play Protect, Play Protect may then offer to scan the app; "More details", then "Install without scanning", installs it without sending it to Google, after the phone's lock screen check. The Windows app closes while its installer runs.

## The server and dashboard

1. Set the new version in `server/package.json`. The server reads it at startup and reports it in `/api/health`.
2. Commit, and get the commit onto `main`.
3. Tag that commit `server-v<version>`, and push the tag.

Nothing is built. The `server.yml` workflow checks that the tag and `server/package.json` agree, and `node scripts/release.ts check server server-v0.2.3` runs the same check by hand. A tag that fails the check is still the newest release to every server, so delete it and tag again.

The install script checks out the newest `server-v*` tag, and a running server tells the apps when a newer one exists, as [running the server](server.md#updating) describes. The first install needs a `server-v*` tag to exist; the first server release is `server-v0.1.0`.

## Preview apps

A preview app is a test build of the Windows or Android app. It installs next to the real app, keeps its own data and sign-in, and updates from its own feed. The real apps never see a preview build.

To publish one, open the `Preview apps` workflow in GitHub Actions, press Run workflow, pick the branch under "Use workflow from", and choose Android, Windows, or both. Only someone with write access to the repo can start it. The workflow runs `android.yml` and `windows.yml` for that branch, and they change the app's config on the build machine only. Nothing is committed and no tag is made.

| | Real app | Preview app |
| --- | --- | --- |
| Name | Botsman | Botsman Preview |
| App id | `dev.botsman.app` | `dev.botsman.app.preview` |
| Version | The config file's version, such as `0.2.0` | `0.0.<run number>-preview+<config version>.<commit>`, such as `0.0.42-preview+0.2.0.abc1234` |
| Android version code | `major * 10000 + minor * 100 + patch` | The run number |
| Update feed | The `updates` release | The `preview` release |

The run number is the preview workflow's run counter. It grows with every run in the repo and never resets. It leads the version, so each preview is newer than the one before, whichever branch it came from and whatever version that branch's config file states. Semver ignores everything after `+` when it compares versions, so the config version and the commit there only name the code. Nothing guesses the next release's version.

The `preview` release holds the newest preview of each app and its manifest, `android.json` or `windows.json`, with the same fields as the ones in `updates`. Each run replaces them, so every preview app is offered the build from the last run, whichever branch that was. Runs wait for each other, so the last run started is the one the feed ends on. The preview build's manifest address names the repo the workflow runs in, so a fork's preview apps read the fork's own `preview` release without any file being edited.

A preview needs the signing keys to be published. Without them, for example in a fork with no keys set up, the workflow still builds the APK and the installer, keeps them as workflow artifacts for 7 days, and publishes nothing. Those builds install by hand and don't update themselves. Android installs a preview over an earlier one only when both carry the same signing key.

## Signing keys

| Secret in GitHub Actions | Used for |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` | Signing the APK. Android installs an update only when it carries the same key as the installed app. |
| `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Signing the Windows update. The matching public key is in `tauri.conf.json`. |

GitHub never shows a secret again, so the owner keeps a copy of both keys elsewhere. With a key lost, installed apps can't take another update and must be reinstalled by hand.

A fork uses its own keys, its own public key in `tauri.conf.json`, and its own manifest addresses for real releases: `plugins.updater.endpoints` in `tauri.conf.json` and `extra.updateManifestUrl` in `apps/android/app.json`. Preview builds set their manifest address from the repo they are built in. [Testing changes](testing.md) covers a fork's preview apps and preview server.

# Testing changes

A change can be tried on real devices without touching anyone's real Botsman. The preview apps install next to the real apps, and a preview server runs next to the real server. Sign the preview apps in to the preview server, so the real apps and the real server never run code under test.

Contributors without write access work in their own fork. A fork has its own workflow runs, its own `preview` release, and its own feed, so previews in one fork never reach another fork's devices.

## Checks

```bash
pnpm install
pnpm -r typecheck
pnpm lint
pnpm -r test
```

A pull request runs these in GitHub Actions on every push. When it changes an app, it also builds that app once it's ready for review, and a draft builds only when a maintainer adds the `build-apps` label. A pull request merges only when these checks and the app builds pass. A pull request from a fork never builds the apps. A fork builds them in the fork as below.

## Preview apps

In the repo, or in a fork with Actions turned on:

1. Push the branch.
2. In GitHub Actions, open `Preview apps`, press Run workflow, pick the branch under "Use workflow from", and choose Android, Windows, or both.
3. When the run finishes, install the build from the `preview` release, or from the run's artifacts when nothing was published.

Preview apps are named Botsman Preview everywhere they show a name: the launcher or Start menu, the wordmark, alerts, Settings, and, on Windows, the window title and tray icon. A preview server's web dashboard is named Botsman Preview too. They have their own app id, data, and sign-in. Their version, such as `0.0.42-preview+0.2.0.abc1234`, names the run, the branch's own version, and the commit, and Settings shows it. [Releasing](releases.md#preview-apps) explains the version and the feed.

Publishing to the `preview` release needs the signing secrets listed in [releasing](releases.md#signing-keys). A fork sets up its own:

| Without signing secrets | With signing secrets |
| --- | --- |
| The APK and installer are workflow artifacts for 7 days | They are published to the fork's `preview` release |
| The Android APK has a debug signature | The APK carries the fork's key |
| Builds install by hand and don't update themselves | Preview apps offer each newer preview |

A Windows preview that updates itself also needs the fork's own updater public key in `plugins.updater.pubkey` in `apps/windows/src-tauri/tauri.conf.json`, committed on the branch, because Tauri refuses an update signed with another key. The preview's feed address needs no change: the workflow points it at the repo it runs in.

To build without GitHub Actions:

- Android: `pnpm --filter @botsman/android prebuild`, then `./gradlew assembleRelease` in `apps/android/android`.
- Windows: `pnpm --filter @botsman/windows tauri build --config '{"bundle":{"createUpdaterArtifacts":false}}'` on Windows.

These build the real app's id and version, so they replace an installed real app.

## Preview server

On a machine with the real server, or any Linux machine that can run one, from a checkout of the repo or the fork:

```bash
deploy/install.sh --preview <branch>
```

It clones a second checkout into `~/botsman-preview`, checks out the branch, and runs it as the `botsman-preview` service on port 7601 with its data in `~/.botsman-preview`. The real server's service, port, and data stay as they are. Run the same command again after pushing more commits, or with another branch. [Running the server](server.md#preview-server) has the details, including TLS and removal.

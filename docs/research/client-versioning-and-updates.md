# Client versioning and updates

How 18 self-hosted projects version their web UI and standalone clients, state compatibility with the server, deliver client updates, and tag releases. Facts were checked on 2026-11-16 against each project's default branch, latest release, and official docs. Version numbers quoted are the ones live on that date.

## Patterns

The survey covers 7 agent and assistant apps (Open WebUI, LibreChat, AnythingLLM, Jan, Khoj, LobeHub, OpenClaw) and 11 general self-hosted apps (Home Assistant, Immich, Jellyfin, Nextcloud, Bitwarden, Vaultwarden, Mattermost, Matrix with Synapse and Element, Syncthing, Tailscale with Headscale, Coder).

**Web UI version.** 15 of the 18 have a hosted web UI whose packaging was confirmed. Jan and Tailscale with Headscale have none, and OpenClaw's wasn't confirmed.

| Pattern | Count | Projects |
| --- | --- | --- |
| Same version as the server, built in the server's release | 10 | Open WebUI, LibreChat, AnythingLLM, Khoj, LobeHub, Immich, Mattermost, Nextcloud, Syncthing, Coder |
| Separate repo, same version number and tag as the server, joined at packaging | 1 | Jellyfin |
| Separately versioned build that the server release pins | 3 | Home Assistant, Bitwarden, Vaultwarden |
| Independent product that the server doesn't ship | 1 | Element Web with Synapse |

**Client versions.** 11 projects have standalone clients that talk to a separate server.

| Pattern | Count | Projects |
| --- | --- | --- |
| Clients carry the server's version | 4 | Immich, Khoj, OpenClaw, Coder |
| Clients have their own version line | 7 | Home Assistant, Jellyfin, Nextcloud, Bitwarden, Mattermost, Element, Tailscale with Headscale |

Vaultwarden has no clients of its own and serves Bitwarden's. Every project with native mobile apps in app stores and a separate client repo versions those apps apart from the server. Immich and OpenClaw keep the apps in the server's repo and share the number.

**Compatibility.** Of the 11 projects with standalone clients, 10 have a mechanism, and none was found in Khoj. Three mechanisms appear, often together.

| Mechanism | Count | Projects |
| --- | --- | --- |
| Comparing product version numbers, with a minimum or a window | 7 | Immich, Jellyfin, Nextcloud, Mattermost, Home Assistant, Bitwarden, Coder |
| An integer protocol or capability version | 2 | OpenClaw, Tailscale with Headscale |
| A list of supported spec versions | 1 | Matrix |
| Capability or feature flags sent at connect, alongside one of the above | 4 | OpenClaw, Home Assistant, Matrix, Bitwarden |

On a mismatch, most projects warn and keep working. Headscale refuses the connection, Nextcloud pauses sync, and Mattermost mobile shows an alert the user can't dismiss.

**Where client updates come from.** Every desktop and mobile client in the survey updates from a vendor host: an app store, GitHub Releases, or the vendor's own download server. One project has the self-hosted server hand out a client. Coder serves its command-line client from the deployment. No surveyed project has the self-hosted server serve a desktop GUI installer or a mobile build.

**Tags.** 10 projects put one tag on everything in their main repo: Open WebUI, LibreChat, AnythingLLM, Jan, Khoj, LobeHub, OpenClaw, Immich, Syncthing, and Coder. Bitwarden tags each client separately inside one repo. The other 7 split components across repos, each with its own tags.

## Comparison

| Project | Web UI version | Client versions | Compatibility mechanism | Client updates come from | Tags |
| --- | --- | --- | --- | --- | --- |
| Open WebUI | Shared. Backend reads `package.json`. | Desktop app has its own (0.1.4 against 0.13.3) and runs a local copy | None between desktop and a remote server, since there is no such link | GitHub Releases, through `electron-updater` | One tag per repo |
| LibreChat | Shared. `api` and `client` carry the same number. | No native clients | None found | Not applicable | One tag |
| AnythingLLM | Shared | Desktop builds ship on the same release, same number | Not applicable. Desktop bundles its own server. | Vendor download page and GitHub Releases | One tag |
| Jan | No hosted web UI | Desktop only | Not applicable | Vendor endpoint, then GitHub `latest.json`, through the Tauri updater | One tag |
| Khoj | Shared | Desktop, Obsidian, and Emacs clients share the server's number | None found | ToDesktop for desktop | One tag |
| LobeHub | Shared. The web app is the server. | Desktop built from the same repo and release | Not confirmed | Vendor update server per channel, GitHub as fallback | One tag |
| OpenClaw | Not confirmed | Apps share the Gateway's `year.month.patch` number | Integer protocol version. Client sends a min and max. Capability list in the handshake reply. | Google Play, or a signed APK on GitHub Releases | One signed tag |
| Home Assistant | Separate. Date-based package pinned by core. | Own versions per app | Per-feature checks on the server's version, and a capability message from app to frontend | App stores and GitHub Releases | Per repo |
| Immich | Shared. Built into the server image. | Mobile shares the server's number | App compares its version to the server's. Window of one major. | App stores and APKs on GitHub Releases | One tag |
| Jellyfin | Separate repo, same number and tag | Own versions per client | Kotlin SDK holds a minimum server version | App stores, F-Droid, vendor download archive | Per repo. Server and web share a tag name. |
| Nextcloud | Shared. Part of the server. | Own versions | Client holds a minimum server version. Server config holds a minimum and maximum desktop version. | `updates.nextcloud.org` for desktop, stores for mobile | Per repo |
| Bitwarden | Separate component with its own tag and its own entry in the self-host version file | Own tag per client, same calendar scheme | Policy window of two major versions each way. Server reports version and feature states. Clients send a version header. | `artifacts.bitwarden.com` for desktop | Server repo tag, plus `web-v`, `desktop-v`, `browser-v`, `cli-v` in the clients repo |
| Vaultwarden | Separate build, pinned by version and image digest | Uses Bitwarden's clients | Reports a Bitwarden server version that clients read | Bitwarden's hosts | Per repo |
| Mattermost | Shared. Same repo, copied into the server package. | Own versions for desktop and mobile | Mobile holds a minimum server version. Docs give a desktop and server table. | `releases.mattermost.com` and stores | Per repo |
| Matrix | Element Web is independent of Synapse | Own versions per client | Server lists the spec versions it supports, plus unstable feature flags | `packages.element.io` for desktop, stores for mobile | Per repo |
| Syncthing | Shared. Compiled into the binary. | One binary, no separate client | Major version comparison for upgrades | `upgrades.syncthing.net`, with the URL configurable | One tag |
| Tailscale and Headscale | Not applicable | Tailscale clients are a separate project from Headscale | Integer capability version. Headscale accepts the last 10 client releases. | Tailscale's hosts | Per project |
| Coder | Shared. Served by the server binary. | CLI shares the server's version | Server sends its version on every response. CLI warns unless they match. | The deployment itself, at `/bin/` and `/install.sh` | One tag |

## Agent and assistant apps

### Open WebUI

The backend reads its version from the repo's `package.json`, the same file the frontend builds from, and the Dockerfile builds the frontend in a Node stage of the same image. The server's `/api/version/updates` route asks the GitHub API for the latest release of `open-webui/open-webui` and returns the current and latest versions. `ENABLE_VERSION_UPDATE_CHECK` turns it off.

Open WebUI Desktop lives in its own repo with its own version, 0.1.4 against the server's 0.13.3. Its README says it "runs your own local copy of Open WebUI", so it isn't a client of a remote server. It uses `electron-updater`, and its GitHub release carries the `latest.yml` files that library reads.

### LibreChat

Root, `api`, and `client` carry the same version, `v0.8.9-rc1`. The shared libraries published to npm have their own numbers, 0.8.530 for `data-provider` and 1.7.55 for `packages/api`. The Dockerfile builds the frontend inside the server image. LibreChat has no native clients. Every release on GitHub is marked as a prerelease, so the "latest release" API returns 404.

### AnythingLLM

The root and `server` packages are both 1.19.0, and `frontend/package.json` has no version field. Release `v1.19.0` carries the desktop installers for Windows, macOS, and Linux beside the server source, under one tag. The desktop app is the whole product in one install. It isn't a client of a self-hosted server. Its update mechanism wasn't confirmed.

### Jan

Jan is a Tauri desktop app with no hosted web UI. Its `tauri.conf.json` lists two updater endpoints in order: `https://apps.jan.ai/update-check`, then `https://github.com/janhq/jan/releases/latest/download/latest.json`. The release carries `latest.json` and the installers. Windows updates install in `passive` mode.

### Khoj

`scripts/bump_version.sh` sets one version on the web app, the desktop app, the Obsidian plugin, and the Emacs package in a single run. The server and all clients share one number and one tag. The desktop app updates through ToDesktop's updater. The latest release, `2.0.0-beta.28`, dates from 2026-03-26.

### LobeHub

The root package and the release are both 2.3.3. `apps/desktop/package.json` holds `0.0.0` as a placeholder, and the release assets are named `LobeHub-2.3.3`. The desktop build publishes to a vendor update server with a path per channel when `UPDATE_SERVER_URL` is set, and falls back to GitHub otherwise. The same GitHub release carries the `latest.yml` files.

### OpenClaw

OpenClaw is the closest match to Botsman's shape: a Gateway the owner runs, plus macOS, iOS, and Android apps in the same repo.

- **Version.** One `year.month.patch` number, such as 2026.11.3, with a `v` tag. Release tags are annotated and signed, and published versions are never replaced.
- **Compatibility.** The Gateway WebSocket protocol has an integer version, kept in `packages/gateway-protocol/src/version.ts`. A client sends `minProtocol` and `maxProtocol`. Operator and UI clients must include the current version, 4. Nodes may use the previous one, 3. The Gateway's `hello-ok` reply lists capabilities, and newer commands require a named capability as well as the method being present.
- **Updates.** The Android app is on Google Play and, for sideloading, as a signed APK on selected GitHub releases. The docs warn that Play and standalone installs "may have different signing identities" and that switching can require an uninstall, which removes local data. The app's manifest doesn't request `REQUEST_INSTALL_PACKAGES`, so it doesn't install its own updates.

## General self-hosted apps

### Home Assistant

- **Web UI.** The frontend is a separate repo and a separate PyPI package with a date-based version. Core pins it exactly. The frontend integration's manifest on the development branch requires `home-assistant-frontend==20261028.6`, while core's latest release is 2026.11.1.
- **Clients.** The Android and iOS apps have their own repos and versions.
- **Compatibility.** The Android app keeps the server's version and gates single features on it, for example `version?.isAtLeast(2025, 6, 0)` before it uses the `navigate` command. The companion docs state a floor of Home Assistant 0.104.0. The frontend asks the app what it can do with a `config/get` message, and the app answers with optional flags such as `hasSettingsScreen` and `canWriteTag`.
- **Updates.** App stores, plus APKs on GitHub Releases in full and minimal flavours. The manifest doesn't request the install permission.

### Immich

- **Web UI and clients.** Server, web, and mobile share one number. The server Dockerfile builds the web app into the image. One tag, `v3.4.1`, covers everything, and its release carries the APKs.
- **Compatibility.** The app compares its own version to the server's. At login it warns if the app's major version is behind the server's, or more than one major ahead. Once signed in, it marks the client out of date when it is behind the server by more than a patch, and marks the server out of date when the server is behind the app. All users see the client warning. Only admins see the server one.
- **Updates.** The server checks a version endpoint for new server releases. The app doesn't install its own updates: its manifest has no install permission.

### Jellyfin

- **Web UI.** `jellyfin-web` is a separate repo that carries the same tag as the server, `v12.4`. The packaging repo checks out the same tag in both and refuses a tag that one of them lacks.
- **Clients.** Each client has its own repo and version. The Android app is at 2.7.3.
- **Compatibility.** The Kotlin SDK holds `minimumVersion`, currently 12.0.0, and the API version it was generated from. Server discovery reports `UnsupportedServerVersion` or `OutdatedServerVersion` as issues with a score. It doesn't refuse the server.
- **Updates.** Google Play, Amazon Appstore, F-Droid, and a vendor download archive. No install permission in the manifest.

### Nextcloud

- **Web UI.** Part of the server.
- **Clients.** Desktop and Android have their own repos and versions.
- **Compatibility, client side.** The desktop build sets `NEXTCLOUD_SERVER_VERSION_MIN_SUPPORTED_MAJOR` to 20. Below it, the client shows a tray message, "Unsupported Server Version", and pauses every sync folder on that account.
- **Compatibility, server side.** `minimum.supported.desktop.version` defaults to `3.3.50`, and "connections from earlier clients will be denied". A matching maximum defaults to `99.99.99`.
- **Updates.** The desktop updater reads `https://updates.nextcloud.org/client/`. The server's `customclient_*` settings hold links to the client download pages. They point at the vendor site and the stores, and the server doesn't host the builds.

### Bitwarden

- **Web UI.** The web vault is one of the clients. It has its own tag, `web-v2026.10.1`, and the self-host installer's `version.json` lists `coreVersion` and `webVersion` as separate entries.
- **Clients.** One repo holds web, desktop, browser, and CLI, each tagged on its own: `desktop-v2026.10.4`, `browser-v2026.10.2`, `cli-v2026.10.1`. All use `YYYY.M.patch`, and the patch numbers drift apart.
- **Compatibility.** The written policy has two rules. Every server release works with clients up to two major versions older or newer, and every client release does the same for servers. The second number is the major version. A breaking server change waits three major versions after the last client that needs the old behaviour. Clients send a `Bitwarden-Client-Version` header. The server's `/config` route returns its version and a map of feature states. Obsolete clients aren't blocked in general. The server may refuse to sign one in when it would damage the user's data.
- **Updates.** The desktop app's update feed is `https://artifacts.bitwarden.com/desktop`.

### Vaultwarden

Vaultwarden is an independent server for Bitwarden's clients. Its web vault is a separate build from the `bw_web_builds` repo, pinned in `docker/DockerSettings.yaml` by both a version and an image digest, and copied into the server image. Server 1.37.5 pins web vault `v2026.10.1`. Its `/api/config` route reports a Bitwarden server version, currently `2026.6.0`, because, in the source's words, "the clients use this version to handle backwards compatibility concerns".

### Mattermost

- **Web UI.** The web app sits in the server repo, carries the server's version, and the release build copies its output into the server package.
- **Clients.** Desktop (6.3.2) and mobile (2.45.1) have their own repos and versions.
- **Compatibility.** The mobile app holds `MIN_REQUIRED_VERSION`, now `9.11.0`. Below it, the app shows an alert titled "Server upgrade required" that can't be cancelled. A second, softer threshold shows system admins an unsupported server warning. For desktop, the docs keep a table of which server versions each desktop release works with.
- **Updates.** The desktop app checks `https://releases.mattermost.com/desktop`, or sends the user to the Microsoft or Mac store. The mobile release on GitHub carries unsigned builds.

### Matrix: Synapse and Element

Clients and servers come from different projects, so compatibility rests on the spec. `GET /_matrix/client/versions` returns the spec versions the server supports, and an `unstable_features` map for experimental ones. Element Web is a separate product with its own version, and Synapse doesn't ship it. Element Desktop self-updates on Windows and macOS from `update_base_url`, set to `https://packages.element.io/desktop/update/` in the release config. Its docs say the feed "can be served by a static file host, CDN or object storage". Element Web's `desktop_builds` and `mobile_builds` settings let whoever hosts the web app choose where the links to the apps point.

### Syncthing

One binary holds the sync engine and the web GUI, which is generated into the build from the `gui` folder. Automatic upgrades read `releasesURL`, which defaults to `https://upgrades.syncthing.net/meta.json` and can be changed in the config. The upgrade code treats a major version step as its own case.

### Tailscale and Headscale

Tailscale's control protocol uses a single integer, `CapabilityVersion`, now 151. The source keeps a line per bump saying what changed, dated from version 5 on. Headscale, the self-hosted control server, maps capability versions to Tailscale releases, supports the last 10 releases, and sets `MinSupportedCapabilityVersion` to 116. A client below it gets HTTP 400 and a log line naming the minimum version.

### Coder

Coder shows the one pattern the others lack. The server sends its build version in a response header. The CLI compares it to its own and prints "version mismatch: client X, server Y" with an upgrade command. Since v2.19.0 that command is `curl -fsSL <deployment>/install.sh | sh`. The server serves the script and the CLI binaries under `/bin/`, so the client a user gets always matches their server.

## Update mechanics for Botsman's stack

### Tauri 2 updater plugin

- **Signing.** The updater "needs a signature to verify that the update is from a trusted source. This cannot be disabled." The public key goes in `tauri.conf.json` as content, not a path. The private key is set at build time through `TAURI_SIGNING_PRIVATE_KEY`. Losing it means installed apps can't take new updates.
- **Endpoints.** `plugins.updater.endpoints` is a list of URLs. The updater moves to the next URL only on a non-2XX status. TLS is enforced in production unless `dangerousInsecureTransportProtocol` is set. A URL may contain `{{current_version}}`, `{{target}}`, and `{{arch}}`.
- **Static JSON.** A file with `version`, and for each platform key such as `windows-x86_64`, a `url` and a `signature`. The signature is the content of the `.sig` file. Tauri validates the whole file before it reads the version.
- **Dynamic server.** Reply 204 when there is no update. Reply 200 with `version`, `url`, and `signature` when there is one. `notes` and `pub_date` are optional.
- **Runtime configuration.** Rust code can set the endpoints and the public key when it builds the updater, and can add request headers such as `Authorization`. The JavaScript `check()` call accepts headers, a proxy, and a timeout, but not endpoints. An app can therefore point the updater at an address it learns after install.
- **Downgrades.** A custom `version_comparator` lets the app install whatever version the server sends.
- **Windows.** `createUpdaterArtifacts: true` reuses the NSIS or MSI installer as the update bundle and writes a `.sig` beside it. `installMode` defaults to `passive`. The app exits when the install step runs.

Jan uses this with a vendor endpoint first and a GitHub `latest.json` second.

### Android APK outside Google Play

- **Permission.** An app targeting API 26 or later must declare `REQUEST_INSTALL_PACKAGES` to start an install. The user grants "install unknown apps" per source app, and `PackageManager.canRequestPackageInstalls()` reports whether they have.
- **Signing key.** On an update, "the system allows the update if the certificates match". An APK signed with another certificate must use another package name and installs as a new app.
- **Updates without a prompt.** From Android 12, a `PackageInstaller` session with `USER_ACTION_NOT_REQUIRED` skips the confirmation when the installer declares `UPDATE_PACKAGES_WITHOUT_USER_ACTION`, is updating itself or is the installer of record, and the new APK targets a recent enough API level: 33 or higher on Android 15, 34 or higher on Android 16. The bar rises with each Android release, and the installer must still handle a request for user action.
- **Developer verification.** From 2026-09-30, certified Android devices in Brazil, Indonesia, Singapore, and Thailand apply developer verification, and Google plans to extend it to all certified devices in 2027. Google offers limited distribution accounts for sharing an app with up to 20 devices, and an advanced flow for users who choose to install unverified apps.

How projects with direct APKs handle updates:

| Project | Approach |
| --- | --- |
| Signal, website build | Full in-app updater. Fetches `https://updates.signal.org/android/latest.json`, compares `versionCode`, downloads the APK, checks its SHA-256 digest against the manifest, and installs through `PackageInstaller` with `USER_ACTION_NOT_REQUIRED`. Only the website build flavour sets the manifest URL and declares the two permissions. |
| NewPipe | Notify only. Fetches `https://newpipe.net/api/data.json`, compares `version_code`, and shows a notification that opens the APK's URL. Runs only when the installed APK carries the official signing certificate. |
| Obtainium | A separate app that watches release pages, GitHub among them, and installs new APKs. It holds the install permission, and the app being updated needs none. |
| Immich, Jellyfin, Home Assistant, Mattermost, OpenClaw | No in-app installer. Their manifests don't request `REQUEST_INSTALL_PACKAGES`. Users update through a store, F-Droid, Obtainium, or by hand. |

## What this implies for Botsman

Two facts about Botsman narrow the choices. The repo is private. GitHub serves releases to people with read access to the repository, and its release asset API works without authentication only for public resources, so an app can't read updates from GitHub Releases without a token. The Android app is a direct APK, so no store delivers its updates.

### Option a: one version and one tag

Server, dashboard, Windows app, and Android app share one number, as Immich, Khoj, and OpenClaw do.

- One number to reason about, and "do they match" is the whole compatibility question.
- Every release rebuilds and re-signs both apps, even for a server-only fix. An Android release build takes about 21 minutes, and a Windows build needs a Windows machine.
- A compatibility rule is still needed, because the owner updates the server and the two apps at different moments. Immich's rule is a window on the major version, and Coder's is an exact match with a warning.
- A hotfix to one app pulls the shared number forward for the other three parts.

### Option b: three versions and an integer protocol version

The server with its dashboard, the Windows app, and the Android app each have their own version. The `protocol` package holds an integer. The server reports the range it supports, and each app knows the range it speaks.

- Matches how OpenClaw and Tailscale state compatibility, and how the 7 projects with separate client version lines release.
- An app can ship alone. Compatibility changes only when the integer does, so most releases need no check at all.
- The integer needs discipline: someone must decide, on each protocol change, whether it bumps. Tailscale records a dated line per bump.
- On a mismatch the choices seen are a warning (Immich, Coder), a pause (Nextcloud), a blocking alert (Mattermost), and a refused connection (Headscale). The dashboard never mismatches, since the server serves it.
- Capability flags in the handshake, as in OpenClaw's `hello-ok` and Home Assistant's `config/get`, can gate single features without a protocol bump.
- Tags become per component, as in Bitwarden's `desktop-v` and `web-v` prefixes in one repo.

### Option c: option b with a separately versioned dashboard

The dashboard becomes a fourth build with its own version, which the server release pins and pulls in, as Home Assistant, Bitwarden, and Vaultwarden do.

- Those three projects have a reason Botsman lacks. Home Assistant's frontend has its own team and release rhythm, and Vaultwarden's web vault comes from another project.
- The dashboard and the Windows app are thin shells around the same `pc-ui` screens, so a separate dashboard version would mostly track `pc-ui`.
- The pin adds a step to every server release, and a dashboard fix still needs a server release to reach the owner, unless the server fetches dashboard builds at runtime. No surveyed server does that.
- 10 of the 15 projects with a hosted web UI build it into the server release under the server's version.

### Who serves the client builds

**The server serves them.** Coder is the precedent, for a CLI. The Tauri updater supports it: Rust code can set the endpoint at runtime to the owner's server address and send the access token as a header, and the server answers 204 or the update JSON. The server needs the installer, its `.sig`, and the APK on disk, so they must travel inside the server release or be fetched by the server. The signing keys stay in the build pipeline, since the server only relays signed files.

- Apps update with no outside host and no GitHub token, which fits the private repo and the rule against third-party relays.
- The server can offer exactly the client builds made for its own version, so an app never moves ahead of its server.
- Server releases grow by the size of the builds. An Android APK is about 44 MB per CPU architecture.
- App updates wait on a server update. A fix for one app needs a server release, or a way for the server to fetch newer builds.
- No surveyed project does this for a desktop GUI or a mobile app, so there is no worked example to copy.

**The apps fetch from a release host.** This is what every surveyed desktop and mobile client does.

- GitHub Releases on the private repo needs a token in each app. A public host, such as a public releases repo or a static file host, removes that need and exposes the builds.
- Apps and server update independently, so the protocol range check carries the full load of keeping them compatible.
- Tauri's static `latest.json` works with any file host, and `tauri-action` generates it.

**Android, either way.** Self-update needs `REQUEST_INSTALL_PACKAGES`, the user's "install unknown apps" grant, and every build signed with the same key. Signal's website build is the model for a full in-app updater with a digest check, and NewPipe's for notify only. Leaving updates to Obtainium needs a release page it can read, which a private repo doesn't provide without a token. Developer verification applies to a sideloaded APK on certified devices as it rolls out.

## Not confirmed

- Hermes Agent, OpenHands, and Plex weren't surveyed. Hermes Agent's default branch holds `0.0.0` placeholder versions, so its scheme couldn't be read from source.
- OpenClaw: how the Gateway packages its web UI, and the macOS app's update feed.
- LobeHub: whether the desktop app checks compatibility with a self-hosted server.
- AnythingLLM: the desktop app's update mechanism.
- Mattermost: what the mobile app does after the user accepts the "Server upgrade required" alert.
- Nextcloud Android and Element's mobile apps: their minimum server rules.
- Immich: the release workflow step that attaches the APKs. The APKs were seen on the release itself.
- MeshCentral is often cited as a server that updates its own agents. No primary source for it was read.
- That no self-hosted server hands out desktop GUI or mobile builds holds for the 18 projects surveyed, not for all projects.
- The Tauri updater facts come from the plugin's docs page, last changed 2025-11-28. The plugin's current release wasn't checked for behaviour changes.
- No Expo or React Native library for installing an APK was evaluated.

## Sources

Tauri and Android

- [Tauri updater plugin docs](https://v2.tauri.app/plugin/updater/) and [their source](https://github.com/tauri-apps/tauri-docs/blob/HEAD/src/content/docs/plugin/updater.mdx)
- [Android: `PackageInstaller.SessionParams`](https://developer.android.com/reference/android/content/pm/PackageInstaller.SessionParams)
- [Android: `Manifest.permission`](https://developer.android.com/reference/android/Manifest.permission)
- [Android: `PackageManager.canRequestPackageInstalls`](https://developer.android.com/reference/android/content/pm/PackageManager)
- [Android: sign your app](https://developer.android.com/studio/publish/app-signing)
- [Android developer verification](https://developer.android.com/developer-verification)
- [GitHub REST API: release assets](https://docs.github.com/en/rest/releases/assets), [GitHub: about releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)
- [Signal `ApkUpdateJob.kt`](https://github.com/signalapp/Signal-Android/blob/HEAD/app/src/main/java/org/thoughtcrime/securesms/jobs/ApkUpdateJob.kt), [`ApkUpdateInstaller.kt`](https://github.com/signalapp/Signal-Android/blob/HEAD/app/src/main/java/org/thoughtcrime/securesms/apkupdate/ApkUpdateInstaller.kt), [website manifest](https://github.com/signalapp/Signal-Android/blob/HEAD/app/src/website/AndroidManifest.xml), [`build.gradle.kts`](https://github.com/signalapp/Signal-Android/blob/HEAD/app/build.gradle.kts)
- [NewPipe `NewVersionWorker.kt`](https://github.com/TeamNewPipe/NewPipe/blob/HEAD/app/src/main/java/org/schabi/newpipe/NewVersionWorker.kt), [`ReleaseVersionUtil.kt`](https://github.com/TeamNewPipe/NewPipe/blob/HEAD/app/src/main/java/org/schabi/newpipe/util/ReleaseVersionUtil.kt)
- [Obtainium README](https://github.com/ImranR98/Obtainium/blob/HEAD/README.md), [manifest](https://github.com/ImranR98/Obtainium/blob/HEAD/android/app/src/main/AndroidManifest.xml)

Agent and assistant apps

- Open WebUI: [`env.py`](https://github.com/open-webui/open-webui/blob/HEAD/backend/open_webui/env.py), [`main.py`](https://github.com/open-webui/open-webui/blob/HEAD/backend/open_webui/main.py), [Dockerfile](https://github.com/open-webui/open-webui/blob/HEAD/Dockerfile), [desktop README](https://github.com/open-webui/desktop/blob/HEAD/README.md), [desktop releases](https://github.com/open-webui/desktop/releases)
- LibreChat: [`package.json`](https://github.com/danny-avila/LibreChat/blob/HEAD/package.json), [`packages/data-provider/package.json`](https://github.com/danny-avila/LibreChat/blob/HEAD/packages/data-provider/package.json), [Dockerfile](https://github.com/danny-avila/LibreChat/blob/HEAD/Dockerfile), [releases](https://github.com/danny-avila/LibreChat/releases)
- AnythingLLM: [`package.json`](https://github.com/Mintplex-Labs/anything-llm/blob/HEAD/package.json), [`server/package.json`](https://github.com/Mintplex-Labs/anything-llm/blob/HEAD/server/package.json), [releases](https://github.com/Mintplex-Labs/anything-llm/releases)
- Jan: [`tauri.conf.json`](https://github.com/janhq/jan/blob/HEAD/src-tauri/tauri.conf.json), [releases](https://github.com/janhq/jan/releases)
- Khoj: [`bump_version.sh`](https://github.com/khoj-ai/khoj/blob/HEAD/scripts/bump_version.sh), [desktop `main.js`](https://github.com/khoj-ai/khoj/blob/HEAD/src/interface/desktop/main.js), [releases](https://github.com/khoj-ai/khoj/releases)
- LobeHub: [`electron-builder.mjs`](https://github.com/lobehub/lobehub/blob/HEAD/apps/desktop/electron-builder.mjs), [desktop `package.json`](https://github.com/lobehub/lobehub/blob/HEAD/apps/desktop/package.json), [releases](https://github.com/lobehub/lobehub/releases)
- OpenClaw: [protocol versioning](https://github.com/openclaw/openclaw/blob/HEAD/docs/gateway/protocol/versioning.md), [release policy](https://github.com/openclaw/openclaw/blob/HEAD/docs/reference/RELEASING.md), [Android docs](https://github.com/openclaw/openclaw/blob/HEAD/docs/platforms/android.md), [Android manifest](https://github.com/openclaw/openclaw/blob/HEAD/apps/android/app/src/main/AndroidManifest.xml), [releases](https://github.com/openclaw/openclaw/releases)

General self-hosted apps

- Home Assistant: [frontend integration manifest](https://github.com/home-assistant/core/blob/HEAD/homeassistant/components/frontend/manifest.json), [frontend releases](https://github.com/home-assistant/frontend/releases), [Android `CommandMessage.kt`](https://github.com/home-assistant/android/blob/HEAD/app/src/main/kotlin/io/homeassistant/companion/android/frontend/externalbus/outgoing/CommandMessage.kt), [Android manifest](https://github.com/home-assistant/android/blob/HEAD/app/src/main/AndroidManifest.xml), [external bus docs](https://developers.home-assistant.io/docs/frontend/external-bus/), [companion getting started](https://companion.home-assistant.io/docs/getting_started/)
- Immich: [`version_compatibility.dart`](https://github.com/immich-app/immich/blob/HEAD/mobile/lib/utils/version_compatibility.dart), [`server_info.provider.dart`](https://github.com/immich-app/immich/blob/HEAD/mobile/lib/providers/server_info.provider.dart), [`version.service.ts`](https://github.com/immich-app/immich/blob/HEAD/server/src/services/version.service.ts), [server Dockerfile](https://github.com/immich-app/immich/blob/HEAD/server/Dockerfile), [Android manifest](https://github.com/immich-app/immich/blob/HEAD/mobile/android/app/src/main/AndroidManifest.xml), [releases](https://github.com/immich-app/immich/releases)
- Jellyfin: [packaging README](https://github.com/jellyfin/jellyfin-packaging/blob/HEAD/README.md), [`checkout.py`](https://github.com/jellyfin/jellyfin-packaging/blob/HEAD/checkout.py), [SDK `Jellyfin.kt`](https://github.com/jellyfin/jellyfin-sdk-kotlin/blob/HEAD/jellyfin-core/src/commonMain/kotlin/org/jellyfin/sdk/Jellyfin.kt), [`RecommendedServerDiscovery.kt`](https://github.com/jellyfin/jellyfin-sdk-kotlin/blob/HEAD/jellyfin-core/src/commonMain/kotlin/org/jellyfin/sdk/discovery/RecommendedServerDiscovery.kt), [Android README](https://github.com/jellyfin/jellyfin-android/blob/HEAD/README.md)
- Nextcloud: [desktop `VERSION.cmake`](https://github.com/nextcloud/desktop/blob/HEAD/VERSION.cmake), [`NEXTCLOUD.cmake`](https://github.com/nextcloud/desktop/blob/HEAD/NEXTCLOUD.cmake), [`owncloudgui.cpp`](https://github.com/nextcloud/desktop/blob/HEAD/src/gui/owncloudgui.cpp), [`folderman.cpp`](https://github.com/nextcloud/desktop/blob/HEAD/src/gui/folderman.cpp), [server `config.sample.php`](https://github.com/nextcloud/server/blob/HEAD/config/config.sample.php)
- Bitwarden: [version compatibility policy](https://contributing.bitwarden.com/contributing/version-compatibility/), [clients releases](https://github.com/bitwarden/clients/releases), [self-host `version.json`](https://github.com/bitwarden/self-host/blob/HEAD/version.json), [`ConfigResponseModel.cs`](https://github.com/bitwarden/server/blob/HEAD/src/Api/Models/Response/ConfigResponseModel.cs), [desktop `electron-builder.json`](https://github.com/bitwarden/clients/blob/HEAD/apps/desktop/electron-builder.json)
- Vaultwarden: [`DockerSettings.yaml`](https://github.com/dani-garcia/vaultwarden/blob/HEAD/docker/DockerSettings.yaml), [`Dockerfile.j2`](https://github.com/dani-garcia/vaultwarden/blob/HEAD/docker/Dockerfile.j2), [`src/api/core/mod.rs`](https://github.com/dani-garcia/vaultwarden/blob/HEAD/src/api/core/mod.rs), [web vault builds](https://github.com/dani-garcia/bw_web_builds/releases)
- Mattermost: [`release.mk`](https://github.com/mattermost/mattermost/blob/HEAD/server/build/release.mk), [`version.go`](https://github.com/mattermost/mattermost/blob/HEAD/server/public/model/version.go), [mobile `supported_server.ts`](https://github.com/mattermost/mattermost-mobile/blob/HEAD/app/constants/supported_server.ts), [`global_event_handler.ts`](https://github.com/mattermost/mattermost-mobile/blob/HEAD/app/managers/global_event_handler.ts), [desktop `buildConfig.ts`](https://github.com/mattermost/desktop/blob/HEAD/src/common/config/buildConfig.ts), [desktop releases and compatibility](https://docs.mattermost.com/product-overview/mattermost-desktop-releases.html)
- Matrix: [client-server API, `/_matrix/client/versions`](https://spec.matrix.org/latest/client-server-api/), [Element Desktop update docs](https://github.com/element-hq/element-desktop/blob/HEAD/docs/updates.md), [Element Desktop release config](https://github.com/element-hq/element-desktop/blob/HEAD/element.io/release/config.json), [Element Web config docs](https://github.com/element-hq/element-web/blob/HEAD/docs/config.md)
- Syncthing: [`optionsconfiguration.go`](https://github.com/syncthing/syncthing/blob/HEAD/lib/config/optionsconfiguration.go), [`upgrade_common.go`](https://github.com/syncthing/syncthing/blob/HEAD/lib/upgrade/upgrade_common.go), [`lib/api/auto/doc.go`](https://github.com/syncthing/syncthing/blob/HEAD/lib/api/auto/doc.go), [config docs](https://docs.syncthing.net/users/config.html)
- Tailscale and Headscale: [`tailcfg.go`](https://github.com/tailscale/tailscale/blob/HEAD/tailcfg/tailcfg.go), [`capver_generated.go`](https://github.com/juanfont/headscale/blob/HEAD/hscontrol/capver/capver_generated.go), [`noise.go`](https://github.com/juanfont/headscale/blob/HEAD/hscontrol/noise.go), [Headscale client support](https://headscale.net/stable/about/clients/)
- Coder: [`cli/root.go`](https://github.com/coder/coder/blob/HEAD/cli/root.go), [`site/site.go`](https://github.com/coder/coder/blob/HEAD/site/site.go)

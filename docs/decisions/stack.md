# Technology stack

## Choices

| Layer | Choice | Why |
| --- | --- | --- |
| Language | TypeScript, with a little Rust and Kotlin in the app shells | Pi Durable requires it on the server |
| Repo | One monorepo, pnpm 12.18.0 workspaces | The server and apps share code directly. See [why pnpm](#why-pnpm). |
| Runtime | Node 24, pinned to 24.21 in `.node-version` | Pi needs 22.19 or newer, and our Pi tests ran on 24.21. The server runs its TypeScript directly with Node's type stripping, with no build step. |
| Agent engine | Pi Durable 1.5.0, exact version | Crash recovery, durable waits, and many conversations in one store |
| Models | `pi-ai` | About 35 providers, including a built-in `opencode-go` |
| Claude subscription | `@anthropic-ai/claude-agent-sdk`, as a custom `pi-ai` provider | Runs the owner's own Claude Code login with Pi keeping control of tools and history |
| Skills | The loader from `pi-coding-agent` | Reads [Agent Skills](https://agentskills.io) `SKILL.md` folders |
| MCP | `pi-mcp`, with our own adapter into Pi Durable tools | A complete client with OAuth; Pi Durable has no adapter |
| HTTP and WebSocket | Fastify 5.12.7 with `@fastify/websocket` 11.3.4 | Node-only, with JSON Schema validation built in |
| Message schema | `pi-schema` | Already installed through Pi, no dependencies, no `eval`, and outputs plain JSON Schema. Fastify validates with it directly. Zod 4 appears only in the `claude-agent` module, because the Agent SDK's tool helper requires it. |
| Storage | One Pi SQLite file per bot, and `server.db` through `node:sqlite` with plain SQL | Per-bot backup. A few tables need no ORM. |
| Search | SQLite FTS5 | Built in, and tested with `node:sqlite` |
| Windows app | Tauri 2.12.5, React 19.3.0, Vite 8.3.8, Tailwind 4.3.5, shadcn | Tray, small installer, and WebView2 |
| Windows token storage | The `keyring` crate 4.2.0 | Writes to Windows Credential Manager from Rust |
| Markdown on Windows and web | `react-markdown` 10.1.0 with `remark-gfm` 4.0.1 | Renders to React elements with no raw HTML, and covers tables |
| Fonts | Orbitron, Inter, and Fragment Mono shipped inside each app, from `@fontsource` on Windows and web and `@expo-google-fonts` on Android | The apps draw the same offline, and ask no outside host for fonts |
| Web dashboard | The same React screens in a browser, served by the server | No screens to build twice |
| Android app | Expo 58.0.25, React Native 0.88.1. Native libraries at the versions `expo install` picks. | Native chat feel, and shares TypeScript with everything else |
| Keyboard | `react-native-keyboard-controller` | Tracks the keyboard natively |
| Chat list | Legend List's chat component, with FlashList as fallback | See [risks](../risks.md) for its open keyboard bug |
| Markdown | `react-native-enriched-markdown` | Native text, streaming, code highlighting, and tables |
| Android styling | React Native `StyleSheet` and a shared token file | NativeWind's Tailwind 4 version is still a release candidate |
| Alerts on Android | Our own Kotlin foreground service, as an Expo module | See [notifications](notifications.md) |
| Bot isolation | Bubblewrap, one sandbox per bot | An allow list of paths, separate processes per bot, no root after install, and about 30 ms to start |
| Windows HTTP | Tauri's HTTP plugin, which sends each request from Rust | The webview's origin differs from the server's, so a request from the page would need CORS headers on the server. Rust has no such rule. `client-core` takes `fetch` as an input, so the API client is written once. |
| App updates | Tauri's updater plugin on Windows, and our own installer step on Android | See [versions and releases](#versions-and-releases) |
| Hosting | A systemd user service, TLS from Tailscale Serve or Caddy | One process on one VPS, under a normal user |
| Builds and checks | GitHub Actions | See [GitHub Actions](#github-actions) |
| Tests | Vitest 5.0.5, using Pi's faux model provider through a scripted test model | Tests run with no model bills. M1 has no test against a real model. |
| Type checks | TypeScript 6.0.3, `tsc` with no emit | Checks the sources Node runs as they are |

## Repo layout

```text
apps/windows            thin Tauri shell around pc-ui
apps/web                thin browser shell around pc-ui
apps/android            Expo app, its screens, and Kotlin module
packages/protocol       message schema and types
packages/client-core    shared logic and hooks
packages/pc-ui          React screens for Windows and web
packages/tokens         design tokens
server                  the Botsman server
deploy                  install script, systemd unit, and AppArmor profile
mockups                 clickable UI reference
docs                    this documentation
```

## Versions and releases

Three parts have their own version and their own tag.

| Part | Tag | How it reaches the owner |
| --- | --- | --- |
| Server and web dashboard | `server-v<version>` | `git pull` and `deploy/install.sh`, which also builds the dashboard with Vite |
| Windows app | `windows-v<version>` | GitHub Actions builds the installer, and the server hands it to the app |
| Android app | `android-v<version>` | GitHub Actions builds the APK, and the server hands it to the app |

The dashboard shares the server's version because the server builds and serves it from its own checkout. It can't be released alone, and it can't fall out of step with the server. The Windows app runs the same `pc-ui` screens and still has its own version, because it holds Windows-only code and sits on a device that can lag behind. The shared packages have no version of their own. A change to one of them means a new release of each part it affects.

A fix to one app needs only that app's tag. A fix to the server needs only the server's tag, and the apps offer no update.

### Protocol version

The `protocol` package holds one whole number. It goes up only when a change breaks an existing client or server. A new optional field or a new route leaves it alone.

- The server reports the oldest number it accepts and its current number in `/api/health`. Both start at 1.
- Each app has its number built in, and `client-core` checks it before connecting.
- An app below the server's range shows "Update the app" and offers the update. An app above the range shows "Update the server". Neither connects until the versions fit.
- After a breaking change, the server keeps accepting the previous number until both apps have shipped on the new one.

### Where the apps get updates

The apps fetch updates from the repo's GitHub Releases. The repo is public, so they need no token, and every surveyed project with standalone clients updates them from a release host. The server takes no part in app updates.

GitHub marks only one release in a repo as the latest, and Botsman has three lines of tags. So one release with the fixed tag `updates` holds a small manifest file for each app, and each app's release workflow replaces its manifest after the build is published. A manifest gives the app version, its protocol number, the file's address, and its signature or digest. An app installs a build only when the build is newer than itself and its protocol number is inside the range of the server it is connected to.

- **Windows.** Tauri's updater reads `windows.json` from the `updates` release. Tauri refuses an update without a valid signature, and that check can't be turned off.
- **Android.** The app reads `android.json`, downloads the APK, checks its SHA-256 digest against the manifest, and installs it through Android's package installer. This needs the `REQUEST_INSTALL_PACKAGES` permission and the owner's "install unknown apps" grant. Android accepts the update only when both APKs carry the same signing key.

Someone who forks Botsman sets their own repo address and signing keys at build time.

The Tauri updater key and the Android keystore are GitHub Actions secrets. Losing either key means installed apps can't take another update, so the owner keeps a copy of both outside GitHub.

[Client versioning and updates](../research/client-versioning-and-updates.md) surveys how 18 other projects handle this.

## GitHub Actions

The repo is public, so standard GitHub-hosted runners are free.

- Type checks and tests run on every pull request, on Linux.
- The Windows installer and the Android APK build on their tag, when started by hand, and on a pull request that changes that app or the packages it uses.
- Build artifacts are kept for a short time.

## Why pnpm

A sample repo with this stack's packages was built on one Ubuntu 24.04 x86-64 server, as of 2026-11-06. It had the planned Android libraries, Expo Router, a Kotlin module, `pc-ui` shared by two shells, and the server's packages. Install times come from single runs.

| | Bun 1.4.4 default | Bun 1.4.4 hoisted | pnpm 10.34.9 | pnpm 12.18.0 |
| --- | --- | --- | --- | --- |
| Clean install | 30 s | 30 s | 48 s | 34 to 37 s |
| Duplicate Expo modules | Yes | No | No | No |
| Blocks undeclared imports | Yes | No | Yes | Yes |
| Android release APK | Built | Built | Built | Not built |
| Tauri Linux package | Built | Built | Built | Built |
| Windows `.exe` compile | Passed | Passed | Passed | Not run |
| Web build and server checks | Passed | Passed | Passed | Passed |

Botsman uses pnpm 12.18.0. pnpm has no LTS line. Its [security policy](https://github.com/pnpm/pnpm/blob/main/SECURITY.md) lists no end date for 12.x, and ends 10.x and 11.x on 2027-04-30. [Expo's monorepo guide](https://docs.expo.dev/guides/monorepos/) supports pnpm directly, and if a library breaks under isolated installs, its fix is `nodeLinker: hoisted`.

pnpm 12 is a Rust rewrite, first released on 2026-08-26. [Its release post](https://pnpm.io/blog/releases/12.0) calls it stable, and commands, settings, and lockfile format carry over from pnpm 11, which is the fallback. Its security policy still calls the Rust port not production ready. We found no public reports for pnpm 12 with Expo, React Native, or Tauri, in either direction.

In the sample, Gradle died in both of pnpm 12's Android builds, and the kernel log shows the 7 GB container limit killing a Java process. No APK has been built with pnpm 12. The same limit let pnpm 10 and Bun finish.

Bun's default install hits an [open bug](https://github.com/oven-sh/bun/issues/46208) that makes `expo-doctor` fail on duplicates, and Bun's hoisted install gives up the undeclared import check. npm and Yarn were slower in an earlier comparison, at 121 s and 82 s against pnpm's 22 s and Bun's 10 s on a smaller sample, and both allow undeclared imports.

Server checks imported the Pi packages and the Agent SDK under Node 24, then ran FTS5, HTTP, WebSocket, and the SDK's `claude` program. The server stays on Node.

## Build notes

- **Markdown library.** `react-native-enriched-markdown` needs its install script allowed, through `allowBuilds`. The script downloads the code highlighting and math files, and its source says a build without them still succeeds with those features missing. The package is about 256 MB once they are in. Other dependencies' install scripts stay blocked.
- **Legend List.** Import it from `@legendapp/list/react-native`, because the package root doesn't resolve.
- **Android builds.** A clean release build took about 21 minutes on 4 CPUs for one CPU architecture, and made a 44 MB APK. Allow more than 7 GB of memory. On GitHub Actions the same build takes about 13 minutes. The workflow builds for `arm64-v8a` only, and signs by passing the keystore to Gradle as `android.injected.signing` properties, so the generated Android project needs no signing config of its own.
- **Ignore rules.** `apps/android/.gitignore` ignores `/android/`, the generated project, with the leading slash. Without the slash the rule also hides `modules/*/android`, where the Kotlin modules live.
- **Babel preset.** `babel-preset-expo` is a direct dependency of the Android app. Gradle runs the bundler from inside the generated project, where pnpm does not expose Expo's own copy.
- **Light theme accents.** The light scheme's green, cyan, mint, and blue come from the mockups. Its magenta, `#a01f66`, is our own, because neither the mockups nor `DESIGN.md` give one.
- **Windows builds.** Install pnpm through npm, because [Windows Defender can block its standalone executable](https://pnpm.io/installation). Build on Windows. Tauri documents building from Linux as [a last resort](https://v2.tauri.app/distribute/windows-installer/), and Debian 12's NSIS 3.08 is too old to make the installer.
- **Tauri.** Stay on Node 24, because [the CLI crashes on Node 26](https://github.com/tauri-apps/tauri/issues/16366). [Tauri CLI 2.12 can break Linux bundling](https://github.com/tauri-apps/tauri/issues/16250) when `tray-icon` is enabled only for Windows.
- **What has run.** As of 2026-11-16, with pnpm 12.18.0: GitHub Actions builds a signed release APK, and it runs on a Samsung SM-A217F with Android 12. On that phone the Kotlin module, the `protocol` package, Legend List, the Markdown view, the keyboard controller, and an HTTPS request to a server on the tailnet all work. The same phone updated itself through several test builds with the in-app Install, reading the manifest from GitHub Releases, and stayed signed in. On those builds the bot list's activity line, bot info, memory, notes, settings, the model picker, and the slash menu run on it. The background alerts service runs as a foreground service with its ongoing notification, an approval alerted while the app was closed, and tapping the alert opened that bot's chat. GitHub Actions also builds the Windows installer with its update signature, on `windows-latest`. The web dashboard builds with Vite and runs in a browser against a real server. Both Vite and Metro bundle the `protocol` package, with its `.ts` import paths and `pi-schema`, unchanged.
- **Not yet run.** The Windows installer has not been launched on Windows. The owner does that by hand.
- **Runner memory.** Gradle needs more than 7 GB, so the APK builds on GitHub's standard Linux runner for public repos.

## Why Expo for Android

Chat is most of this app, and it decides the choice. Capacitor would share all screens with Windows, but its chat has the weaker foundation:

- Android 15 and 16 edge-to-edge keyboard bugs are open against Capacitor ([#8432](https://github.com/ionic-team/capacitor/issues/8432)), and a chat app opens the keyboard constantly.
- Developers favour React Native for long lists and interactive screens, and Capacitor for sharing a web UI. A chat screen is a long, dynamic list.
- No benchmark comparing the two for chat exists, so this rests on reports and on the native parts available.

Three reviewers scored Capacitor higher when chat feel counted for 25% of the decision. React Native wins once chat feel counts for 47 to 62%, and chat is the product's first priority.

The cost is real. Every screen gets built twice, and shadcn doesn't carry over to Android. Shared `client-core`, shared hooks, and shared tokens keep behaviour and looks together.

Kotlin was ruled out because login, reconnect, and catch-up would have to be rewritten, and the Software Mansion markdown library lists streaming for React Native but not for its standalone Android SDK. Tauri's Android support is too rough, by the reports we found. Flutter and Compose Multiplatform can't share code with the TypeScript server and Windows app.

## Why not one UI for both apps

Running the Expo web build on Windows would make the desktop feel like a stretched phone app, and Windows is a first-class target. Mixing Capacitor and React Native in one Android app would run two JavaScript engines and two sets of tooling, to host a few small screens. If a heavy screen is ever not worth rebuilding, Expo can show it in a WebView.

## Cost

Expo, React Native, Capacitor, and Tauri are free. Expo's paid EAS cloud service is optional, and apps build locally. Google Play charges a one-time $25, and only if we publish there.

## Sources

- [Capacitor keyboard issue #8432](https://github.com/ionic-team/capacitor/issues/8432)
- [Bret Cameron: React Native vs Capacitor](https://www.bretcameron.com/blog/react-native-vs-capacitor-why-i-use-both)
- [Expo keyboard-controller docs](https://docs.expo.dev/versions/v58.0.0/sdk/keyboard-controller/)
- [Legend List keyboard docs](https://legendapp.com/open-source/list/v3/react-native/keyboard-and-animated/)
- [Enriched Markdown supported features](https://github.com/software-mansion/react-native-enriched-markdown/blob/main/docs/docs/introduction/supported-features.md)
- [NativeWind v5](https://www.nativewind.dev/v5)
- [Expo: work with monorepos](https://docs.expo.dev/guides/monorepos/)

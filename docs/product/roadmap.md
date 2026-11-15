# Botsman roadmap

The server comes first. After that, Windows and Android move through the same milestones together.

## Alpha

**M1. Server core.** One Node process that hosts bots on Pi Durable: bot creation, one SQLite file per bot, login, model provider keys and sign-ins, the app protocol, streaming chat, stop, steer, queue, and catch-up after a reconnect. Includes the sandbox for each bot with Stop closing any process left running, approvals, the four memory files with confirmations, saving before compaction, notes, and keyword search. Also the install script with its AppArmor step, the systemd user service, and nightly backups with restore steps. The web dashboard's path answers with a fixed "coming soon" reply until M2. M1 is tested with Pi's faux provider only, with no run against a real model. Smart mode is accepted as a setting and runs like Off until the classifier exists.

**M2. Apps.** The Windows app, the web dashboard on the same screens, and the Android app: first-run setup, sign-in, bot list, chat, approvals, memory, notes, bot info, bot settings, model providers, usage, signed-in devices, app updates, and alerts through the tray and the Android foreground service. [M2 in detail](#m2-in-detail) sets out the order and what waits.

Alpha is done when the owner uses it daily for chat, shell work, approvals, and memory on both apps.

### M2 in detail

M2 runs in seven steps. Each screen lands on both apps in the same change.

1. **Toolchain check.** Install with pnpm 12, build the web dashboard, build the Android APK in GitHub Actions and open it on a phone, and build the Windows installer in GitHub Actions. The skeleton uses the real libraries: the keyboard controller, Legend List, the Markdown library, a stub Kotlin module, and the Tauri tray. It also confirms that the `protocol` package bundles under Vite and Metro. If something fails, the fallbacks are `nodeLinker: hoisted`, then pnpm 11, then FlashList.
2. **Shared packages.** `tokens` holds Zoetrik dark and Drafting Table light, as CSS variables for `pc-ui` and a TypeScript object for React Native. `client-core` holds the API client, token refresh, the socket with reconnect and catch-up, state for the `server` stream and each chat, the send rule, approvals, retries, the local cache interface, the protocol version check, and the React hooks. Its tests run against the real server with the scripted model.
3. **Server additions.** The server gains what the screens need:
   - the web dashboard's files, and cookie sign-in for it
   - usage history by day and by bot
   - last activity, a preview, and an unread count on each bot, with a read marker
   - alert type settings
   - routes for compact, clear, and retry
   - the protocol version range in `/api/health`
   - app builds for the Windows and Android updaters
4. **One working path on all three clients.** Setup and sign-in, the bot list, chat with streaming, stop, steer, and queue, the reconnect banner, and approvals inline and in Needs you. The first run against a real model happens here.
5. **App updates.** The release workflows, the signing keys, the Windows updater, and the Android updater. This comes early so that later builds reach the owner's devices through it.
6. **Remaining screens.** New bot, bot info, bot settings, memory with pending edits, notes, model providers and their sign-in steps, the model and reasoning picker, usage, settings, signed-in devices, and slash commands.
7. **Alerts and hardening.** The Windows alerts socket, tray, and auto-start. The Android foreground service, boot receiver, and per-brand setup steps. Browser notifications on the dashboard. The local cache, and the recorded event set run through both chat screens side by side.

The owner checks what only Windows can show: the tray, auto-start, Credential Manager, and the installer. These checks don't hold up other steps. Everything else on the PC screens is tested on the web dashboard in a browser, and Android is tested on a real phone.

M2 leaves these out:

- Screens that belong to later milestones. Routines wait for M3. Attachments, clarifying questions, subagent lines, skill and connection toggles, and the Claude subscription sign-in wait for M4. Channels, bot-to-bot chats, the server shell switch, and the restore card wait for M5. Bot settings hides its skills and connections sections until M4.
- Saved servers. An M2 app connects to one server, and changing it means signing out and entering another address. Saving several servers comes before v1.
- Pinning a bot other than the main bot.

Usage history starts on the day the server begins recording it, because M1 kept none.

## Beta

**M3. Routines.** Scheduling, separate conversations for runs, posting results into chat, the memory toggle, and run history.

**M4. Tools.** Skills, web tools, MCP connections, attachments, clarifying questions, and subagent work in chat. Also the [Claude subscription provider](../decisions/permissions.md#claude-subscription), starting with a test of how Pi recovers from a crash during a held tool call, and a check on a real login that resuming a session picks up a changed system prompt. Until then, Anthropic connects with an API key.

## v1

**M5. Main bot and bot conversations.** The main bot's tools for changing other bots, `host_bash` and its switch in both apps, with tests that it stays off when switched off and that other bots can't reach it, requests from other bots to the main bot, bot-to-bot conversations, the loop limit, and channels.

v1 is done when every requirement in the [PRD](PRD.md) is met on both apps, and the owner has moved their daily bots onto it.

## After v1

- Key service: `http_request` with named secrets, per-bot grants, and SSH agent signing
- Vector search over notes, with a local embedding model
- Third-party memory providers
- UnifiedPush, offered alongside the foreground service
- Google Play release, which needs a foreground service review
- Windows code signing
- Voice input and read aloud
- Pages and a per-bot library
- Open-source release

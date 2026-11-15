# Botsman roadmap

The server comes first. After that, Windows and Android move through the same milestones together.

## Alpha

**M1. Server core.** One Node process that hosts bots on Pi Durable: bot creation, one SQLite file per bot, login, model provider keys and sign-ins, the app protocol, streaming chat, stop, steer, queue, and catch-up after a reconnect. Includes the sandbox for each bot with Stop closing any process left running, approvals, the four memory files with confirmations, saving before compaction, notes, and keyword search. Also the install script with its AppArmor step, the systemd user service, and nightly backups with restore steps. The web dashboard's path answers with a fixed "coming soon" reply until M2. M1 is tested with Pi's faux provider only, with no run against a real model. Smart mode is accepted as a setting and runs like Off until the classifier exists.

**M2. Apps.** It starts by installing with pnpm 12, building and launching the Windows app on Windows, and building the Android APK and opening it on a phone or emulator. Then come the `protocol`, `client-core`, `pc-ui`, and token packages, the Windows app, the web dashboard on the same screens, and the Android app: first-run setup, bot list, chat, approvals, memory, notes, bot info, bot settings, model providers, usage, and alerts through the tray and the Android foreground service.

Alpha is done when the owner uses it daily for chat, shell work, approvals, and memory on both apps.

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

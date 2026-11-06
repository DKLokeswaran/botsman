# Botsman product requirements

## What it is

Botsman gives one person a team of AI bots that stay on. Each bot has a purpose, a folder, memory, and a long-running chat. The owner runs the server on a VPS and uses it from Windows, Android, or a web dashboard.

Messaging apps are built for talking to people, and using one as an assistant's front end feels like it. Botsman is a dedicated client, in the style of Grok's bots, with chat as the part that gets the most care.

## Who it is for

One owner per server. Anyone else who wants Botsman runs their own server. The project may be open-sourced later, so nothing may depend on a service only the author can run.

## Principles

1. Chat experience comes first. When chat quality and shared code conflict, chat wins.
2. Windows and Android stay in parity.
3. State lives on the server. Every device shows the same bots, chats, pins, and unread counts.
4. Limit what a bot can do, instead of trying to judge each command.
5. Nothing a bot remembers is hidden from the owner.

## Requirements

### Bots

- BOT-1. The owner creates bots from the app, with a name, description, purpose, default model, and folder. The folder defaults to `~/.botsman/workspaces/<id>`. The form shows the server's free space, and the server refuses unsafe paths. See [bot folders](../decisions/overview.md#bot-folders).
- BOT-2. The owner edits a bot's name, description, and avatar. The owner can upload a photo or choose a mark.
- BOT-3. The owner deletes any bot except the main bot. Deleting marks the bot as deleted on the server and removes it from the apps. Its data stays on the server, and the main bot can restore it. See [deleting a bot](../decisions/overview.md#deleting-a-bot).
- BOT-4. First-run setup creates the main bot. It stays pinned at the top of the list.
- BOT-5. Each bot has a permission mode, approval wait, network toggle, connection toggles, and skill toggles. Shared and server skills start off for every bot.

### Chat

- CHAT-1. Each bot has one chat with the owner. Replies stream as they are written.
- CHAT-2. Chat renders Markdown, tables, code blocks with Copy, thinking, tool lines, todo lists, and file diffs.
- CHAT-3. The owner can stop a reply, steer it with a note, or queue a message for after it.
- CHAT-4. Each chat can override the bot's default model and reasoning effort.
- CHAT-5. The owner can attach images and files.
- CHAT-6. Each finished reply shows tokens and cost, and the header shows the chat's total.
- CHAT-7. The owner can retry a reply, copy a reply, and quote a routine result when replying.
- CHAT-8. Subagent work appears as a line alongside the tool lines. Opening it shows the task and the work so far.
- CHAT-9. The app shows a banner while reconnecting, then catches up without losing the owner's place.
- CHAT-10. Slash commands cover actions with no button: compact, clear, skills, memory, notes, usage, and help.
- CHAT-11. A bot can ask clarifying questions on one card, with options and free text.

### Approvals

- APR-1. Each bot runs in Manual, Smart, or Off mode. See [permissions](../decisions/permissions.md).
- APR-2. An approval offers Allow once, Allow for this chat, and Deny. It shows why the bot is asking, a short description, and the full command.
- APR-3. The approval wait is set per bot and defaults to 1 hour. If unanswered, the action is refused and the bot is told.
- APR-4. Bot edits to memory files always ask for confirmation, in every mode.

### Memory and notes

- MEM-1. Four memory files exist: `USER_PROFILE.md`, `USER_MEMORY.md`, `BOT_PROFILE.md`, and `BOT_MEMORY.md`. The owner writes `PROFILE` files and bots write `MEMORY` files. See [memory](../decisions/memory.md).
- MEM-2. The owner can view and edit all four in the app, with a live character count against each limit.
- MEM-3. A bot's proposed edit shows in Needs you, the bot's chat, and the Memory screen, with the conversation it came from.
- MEM-4. Each bot has notes for longer records, such as projects it tracks, kept outside its folder and reached through its `memory` tool. The owner can browse, search, edit, and delete notes.
- MEM-5. Notes search uses keywords at first. Vector search is planned.

### Routines

- RTN-1. The owner or a bot can create routines on a bot. Schedules are daily, weekdays, weekly, once, or a cron expression.
- RTN-2. Each run uses its own prompt in a separate conversation, with no chat history.
- RTN-3. A routine's memory toggle is off by default. Off means the routine gets only its prompt. On loads all four memory files.
- RTN-4. The result posts into the bot's chat without starting a reply, and the bot sees it in later turns. A routine can also raise an alert.
- RTN-5. The owner can pause, resume, run now, edit, delete, and see run history. History opens the message that run posted.
- RTN-6. A run missed during downtime runs once on restart.
- RTN-7. A routine a bot created is labelled, and creating one alerts the owner.

### Skills and connections

- SKL-1. A bot can create its own skills with a tool. Creating one alerts the owner.
- SKL-2. A shared skill pool exists. Only the main bot adds to it.
- SKL-3. Botsman is a gateway to MCP servers. Only the main bot manages connections, and each bot turns them on or off for itself. Local servers run however the owner configures them, outside bot sandboxes.
- SKL-4. Bots have web search and page fetch tools.
- SKL-5. Botsman follows the Agent Skills convention. Bots can read all of `~/.agents`, and each bot keeps its own skills in `.agents/skills/` in its folder. See [skills](../decisions/overview.md#skills).

### Main bot, bot chats, and channels

- MAIN-1. Only the main bot can change other bots. Other bots stay confined to their own folder.
- MAIN-2. Only the main bot can edit `USER_MEMORY.md`. Other bots ask it to record things. No bot can edit a `PROFILE` file.
- MAIN-3. The main bot can read any bot's files, notes, and chats through tools. These are never loaded automatically.
- MAIN-4. Only the main bot can restore a deleted bot. The apps have no restore control of their own.
- MAIN-5. The main bot can have `host_bash`, a shell on the host for diagnosing and fixing problems. It is off by default, and only the owner turns it on, in the apps. It follows the main bot's approval mode. See [host_bash](../decisions/permissions.md#host_bash).
- CONV-1. All bots can chat with each other. Each pair has one conversation, which the owner can read and step into.
- CONV-2. A line in a bot's chat, such as Junior → Nightwatch, opens that conversation, and shows when it is paused. It adds nothing to the chat's context. The apps have no separate list of these conversations.
- CONV-3. An exchange pauses after 10 messages without the owner, and raises an alert.
- CHAN-1. Channels hold several bots and the owner. Every member receives every message. A bot replies only when mentioned or asked by the owner.

### Alerts

- ALR-1. The apps alert the owner while closed, for approvals, questions, memory edits, routine results, failures, channel mentions, and new routines or skills. Bot-to-bot messages do not alert.
- ALR-2. The owner can turn each alert type on or off.
- ALR-3. Clicking an alert opens the relevant chat.

### Account and servers

- ACC-1. The owner signs in with a password and stays signed in with a refresh token, which can be revoked.
- ACC-2. The apps connect to any HTTPS address, on a tailnet or the public internet. The owner can save several servers.
- ACC-3. The server requires HTTPS and rate-limits login.
- ACC-4. The owner connects model providers in the app, during setup, from Settings, or from the model picker. Keys and sign-ins are stored only on the server, encrypted, and cannot be viewed after saving.
- ACC-5. Usage shows cost over time and by bot.
- ACC-6. The apps update themselves from tagged releases.
- ACC-7. A web dashboard runs the Windows app's screens in a browser. Its notifications arrive only while the site is open in a tab.

### Providers

- PRV-1. The first providers are OpenCode Go, Anthropic, OpenAI, OpenRouter, and GitHub Copilot. Provider settings stay generic, so others can follow.
- PRV-2. Each provider offers every connection method Pi supports. A Claude subscription connects through Claude Code on the server instead of Pi's sign-in, with a Usage label option that defaults to Default. See [model provider access](../decisions/permissions.md#model-provider-access).

## Requirements on quality

- A server crash mid-reply loses no committed work, and the reply resumes on restart.
- The server backs up its SQLite files and bot files every night, and restore is documented.
- Android alerts work with no extra app and no third-party service.

## Not in v1

| Item | When |
| --- | --- |
| Key service, so bots can use API keys they cannot read | After v1 |
| Vector search over notes | After v1 |
| UnifiedPush alerts | After v1 |
| Voice input and read aloud | After v1 |
| Pages and a per-bot library | After v1 |
| iOS | Not planned |
| Import from other assistants | Not planned |

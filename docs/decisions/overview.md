# Architecture overview

```mermaid
flowchart TD
    windows["Windows app (Tauri, React)<br/>screens + client-core<br/>alerts socket in Rust"]
    web["Web dashboard (React)<br/>same screens + client-core"]
    android["Android app (Expo, React Native)<br/>screens + client-core<br/>alerts socket in Kotlin service"]
    server["Botsman server (Node)<br/>one process, one Pi Durable Harness per bot"]
    sqlite[("SQLite files")]
    memory["Memory files"]
    folders["Bot folders"]
    providers["Model providers"]

    windows -- "HTTPS and WebSocket" --> server
    web -- "HTTPS and WebSocket" --> server
    android -- "HTTPS and WebSocket" --> server
    server --> sqlite
    server --> memory
    server --> folders
    server --> providers
```

## Server

One Node process runs as the owner's user, as a systemd user service. It needs no root once installed. It owns all state, and no other process writes to its storage.

```text
~/.botsman/
  server.db                 login, tokens, bot registry, settings, encrypted model keys and sign-ins
  secret.key                the key that encrypts model keys and signs access tokens, left out of backups
  user/USER_PROFILE.md
  user/USER_MEMORY.md
  skills/                   shared skill pool
  bots/<id>/session.sqlite  Pi Durable storage for that bot
  bots/<id>/BOT_PROFILE.md
  bots/<id>/BOT_MEMORY.md
  bots/<id>/notes/
  workspaces/<id>/          the default bot folder, the only writable path in its sandbox
```

Memory files and notes sit outside the bot's folder, so its sandbox hides them, and a bot can only reach them through the `memory` tool. Edits to memory files ask for confirmation.

### Bot folders

The owner chooses a bot's folder when creating it, so a bot that clones large repos can sit on a disk with room for them. The path is on the server, so the form shows the server's free space. Left empty, the folder is `~/.botsman/workspaces/<id>`.

A bot gets read-write access to its whole folder, so the server refuses any path that would expose something else:

- `/` and the owner's home folder
- `~/.ssh`, `~/.claude`, and `~/.agents`
- Botsman's own data, other than the default folder
- another bot's folder

Those checks also apply to anything inside these paths. Chat history, memory files, and notes stay in `~/.botsman` wherever the folder is.

### Skills

Botsman follows the [Agent Skills](https://agentskills.io) convention. A bot's skill list comes from three places:

| Folder | Holds | Bot's access |
| --- | --- | --- |
| `~/.botsman/skills/` | The shared pool, which only the main bot adds to | Read-only |
| `~/.agents/skills/` | The owner's skills, shared with other tools on the server | Read-only |
| `.agents/skills/` in the bot's folder | That bot's own skills | Read-write |

Each bot has a toggle for every skill in the first two folders, off by default, so the owner turns on only what that bot needs. A skill that is off isn't in the bot's skill list. Its files stay readable through the read-only mount. A bot's own skills are always on.

Botsman doesn't load skills from repos cloned into a bot's folder. The bot's skill list gives each skill's full path, because `~` inside a sandbox is the bot's own folder. See [how the sandbox is set up](permissions.md#how-the-sandbox-is-set-up).

### Main parts

| Module | Job |
| --- | --- |
| `engine` | The only code that imports Pi Durable. Opens a Harness per bot, starts conversations, and watches them. |
| `claude-agent` | A custom `pi-ai` provider that runs Claude models through Claude Code. Imports the Agent SDK, not Pi Durable. |
| `api` | Fastify HTTP routes and the WebSocket. Login, rate limits, and token refresh. Serves the web dashboard's files. |
| `events` | Turns Pi's conversation state changes into our own app events. |
| `permissions` | The `beforeTool` hook, approvals, the classifier, and approval waits. |
| `sandbox` | Builds each bot's `bwrap` allow list, starts its `pi-env` daemon, and checks at startup that sandboxes work. |
| `memory` | The four files, proposals, sending changes to bots, and the pre-compaction save. |
| `notes` | Keyword index over each bot's notes. |
| `routines` | Durable sleep tasks that run each routine on schedule. |
| `conversations` | Bot-to-bot exchanges, channels, and the loop limit. |
| `tools` | The `memory` tool, web, messaging, and main bot tools, including `host_bash`. Skills and MCP adapters. |
| `alerts` | Decides which events alert, and streams them to apps. |
| `auth` | The owner's password, device sessions, and access and refresh tokens. |
| `bots` | The bot registry, folder rules, and creating, editing, and deleting bots. |
| `providers` | pi-ai's credential store over `server.db`, the provider list, and sign-ins. |
| `backup` | Nightly backups and the backup command. |

In M1 the `events` module receives Pi's conversation views from the engine as plain data and never imports Pi Durable itself, so the engine is the only importer. Alerts and the `server` stream are published from the service wiring in `server/src/services.ts`. `routines`, `conversations`, and the rest of `tools` come in later milestones.

### Conversations in Pi

Each bot's SQLite file holds its chat with the owner, routine runs, its side of bot-to-bot exchanges, and channel conversations. Each is a separate Pi conversation. [Conversations](conversations.md) sets out what each one sees.

## Protocol

Our own schema, in the `protocol` package, defines every HTTP body and WebSocket message. Apps never see Pi's internal formats, so a Pi upgrade changes only the `engine` and `events` modules.

- **Live updates.** The WebSocket sends events with a per-conversation sequence number. A client signs in with its first message, since browsers can't set headers on a WebSocket.
- **Reconnect.** The client sends the server's epoch and the last sequence it saw, and the server replies with what it missed or a fresh snapshot. The server keeps the last 1,000 events per stream in memory, and its epoch changes on every start, so a client returning after a restart gets a snapshot.
- **Alerts stream.** A second, small stream carries only alert events, for the background connections.

Rust and Kotlin message types for the alerts stream are generated from the same JSON Schema.

## Apps

The `client-core` package holds login, reconnect, catch-up, state, approvals, sending, and retries, in plain TypeScript with no DOM dependency. React hooks wrap it, so a screen on either app gets the same data and actions. The `pc-ui` package holds the Windows and web screens, and Android builds its own on the same hooks.

Android's screens are separate, because the best Android chat needs native views. Between Android and the other two apps, roughly 40% of client code is shared, by estimate: nearly all logic and none of the screens.

`apps/windows` and `apps/web` are thin shells around `pc-ui`, so the web dashboard needs no screens of its own.

| Need | Windows | Web | Android |
| --- | --- | --- | --- |
| Screens | `pc-ui` (React, shadcn) | `pc-ui` (React, shadcn) | React Native, our own components |
| Alerts connection | Rust, in Tauri | The open page's WebSocket | Kotlin foreground service |
| Token storage | Credential Manager | `HttpOnly`, `Secure`, `SameSite` cookie | Keystore |
| Local cache | IndexedDB | IndexedDB | SQLite |
| Auto-start | Tauri | None | Boot receiver |

The alerts connection runs when the UI does not, so it can't live in `client-core`. Its logic stays small: connect, catch up, show a notification.

## Parity

- Screens get everything through shared hooks and hold no logic.
- One recorded set of events (a streaming reply, an approval, a reconnect) runs through both chat screens, for side-by-side comparison.
- `DESIGN.md` and a shared token file define the look.

## Deleting a bot

Deleting a bot sets `deleted_at` on its row in the bot registry. Nothing is erased, and the main bot can't be deleted.

- The server leaves a deleted bot out of everything it sends the apps: the bot list, Needs you, alerts, routines, memory, notes, and its conversations with other bots.
- Lines for those conversations disappear from other bots' chats. Past channel messages stay, so the channel still reads correctly.
- Past costs stay in the usage total, grouped as "Deleted bots".
- Its routines stop, pending approvals and memory edits are refused, and its sandboxes stop.
- Other bots can't find it or message it. The main bot sees it only through its restore tools.
- Its SQLite file, memory files, notes, and folder stay on disk and in backups. Its name is free to reuse.

Only the main bot can restore a deleted bot, using a tool that lists deleted bots and one that restores them. A restore is a change to another bot, so it follows the main bot's approval mode. The bot returns with its chat, files, and conversations. Its routines stay paused until the owner resumes them, and requests refused during the deletion stay refused. If another bot has taken its name, the main bot asks the owner for a new one.

The apps have no permanent erase in v1. That is done on the server by hand.

## Exposure

The server does not care whether its address is on a tailnet or the public internet. It requires HTTPS and treats every deployment as reachable by strangers: rate-limited login, and revocable refresh tokens. TLS comes from Tailscale, a reverse proxy such as Caddy, or certificate files given to the server. The server listens on `127.0.0.1` by default and refuses any request that didn't arrive over TLS, judged from its own TLS or a trusted proxy's `X-Forwarded-Proto`. Login allows 10 password attempts per address every 15 minutes. Access tokens last 15 minutes and refresh tokens 60 days from their last use; each refresh replaces the refresh token. See [running the server](../operations/server.md).

## To settle during the build

- How snapshots of a bot's folder work.
- Whether a bot's folder can move after creation.
- Which web search provider to use.
- Which model the smart approval classifier uses.

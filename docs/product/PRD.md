# Product Requirements Document: Hermes Bots

| Field | Value |
| --- | --- |
| **Product name** | Hermes Bots |
| **Document type** | Product Requirements Document (PRD) |
| **Version** | 1.2 |
| **Status** | Draft |
| **Last updated** | 2026-11-03 |
| **Audience** | Builders implementing the Windows app, the Android app and the companion plugin |
| **Related** | [Roadmap](./roadmap.md), [Architecture](../research/ARCHITECTURE.md), [Feasibility blockers](../research/BLOCKERS.md), [Mockups](../../mockups/README.md), [Design](../../DESIGN.md) |

---

## 1. Overview

### 1.1 Problem

Hermes Agent is a capable self-hosted agent, but its everyday front ends are either a chat app built for people (Discord) or an administrative dashboard. Neither feels like a personal assistant. In Discord, a routine's message cannot be replied to with that message in context, and approvals, questions and live work are awkward to follow from a phone.

### 1.2 Solution

A Grok Bot-style personal-assistant app on a self-hosted Hermes Agent. It brings a selected set of Grok Bot features to Hermes, built in the way Hermes can support them, since the two are different products with similar uses. More Grok Bot features can follow where Hermes makes them possible. It ships as a Windows app and an Android app with the same features:

- Each Hermes profile is a **bot** with one chat.
- **Routines** post their results into the bot's chat on schedule, without starting a reply. Replying in that chat keeps the routine output in context.
- Approvals and clarifying questions appear inline and in a global **Needs you** list.
- **Push notifications** reach the user when the app is closed.
- All state lives in Hermes, so every device stays in sync.

Server side is stock Hermes plus one companion Hermes plugin that ships in this repository. There is no separate server.

### 1.3 Goals

| Goal | Success signal |
| --- | --- |
| Grok Bot-style assistant experience | The user moves fully from Discord to Hermes Bots |
| Routines that talk in the chat | Routine results arrive as messages in the bot's chat, and a reply sees them in context |
| Never miss what needs the user | Approvals, questions and routine results raise a notification with the app closed, on both platforms |
| Platform parity | Every feature ships on Windows and Android together |
| Works against stock Hermes | No Hermes code changes; only config and the companion plugin |
| Lightweight and fast | Small installs, quick start, low memory on both platforms |
| Open-source ready | No dependency on a private server or service; external dependencies kept to a minimum |

### 1.4 Non-goals (through Stable / v1.0)

- A separate backend or relay server
- iPhone, macOS, Linux desktop or web clients
- Multiple users or per-device credentials (one Hermes login)
- Offline use (online-only; nothing readable without a connection)
- Creating or editing bots (profiles) from the app; only the avatar is editable
- Showing or editing Hermes API keys
- History from Discord, the Hermes CLI or other clients
- Side chats (one chat per bot)

---

## 2. Personas and use cases

### 2.1 Persona

**Self-hoster** who runs Hermes Agent on their own server, reaches it at a URL their devices can access (a Tailscale address in the reference setup), and uses several bots as a personal assistant from a Windows PC and an Android phone.

### 2.2 Core use cases

1. Open the app and see every bot with its last message, unread count, working state and anything that needs attention.
2. Chat with a bot and watch the reply stream in, with thinking and tool activity.
3. Approve a risky command or answer a bot's questions from the phone, inline or from Needs you.
4. Create a routine (for example a morning briefing) that posts into the bot's chat on schedule; reply to its result in context, or ask the bot to change the routine.
5. Get a notification when a routine posts, a bot needs approval or has a question, or a long reply finishes, with the app closed.
6. Switch devices mid-conversation and continue where the other device left off.

---

## 3. Terminology

| Term | Definition |
| --- | --- |
| **Bot** | A Hermes profile, shown with an avatar, name, description and model |
| **Main bot** | The bot for the default Hermes profile (Junior); always first in the list and opened at launch on desktop |
| **Chat** | The bot's single conversation, an ordinary Hermes dashboard session |
| **Routine** | A Hermes cron job that posts its output into the bot's chat without starting a reply |
| **Run** | One execution of a routine |
| **Needs you** | Pending approvals and clarifying questions across all bots |
| **Room** | A shared channel where several bots and the user talk |
| **Companion plugin** | The `hermes-bots` Hermes plugin: routine delivery platform, push hooks, alert stream |
| **Alert** | A content-free notification event: the bot and the kind of event, never message text |
| **Parity** | The same feature and behaviour on Windows and Android |

---

## 4. Functional requirements

Priority: **P0** is required at Alpha exit (MVP), **P1** at Stable / v1.0, **P2** after v1.0.

### 4.1 Connection and login (FR-CONN)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-CONN-1 | Sign in with the Hermes dashboard username and password; stay signed in as long as Hermes allows (refresh token) | P0 |
| FR-CONN-2 | When the session expires, show the login screen with the username filled in | P0 |
| FR-CONN-3 | Connect to a Hermes server at any URL the device can reach (HTTP or HTTPS, IP address or host name) | P0 |
| FR-CONN-4 | Show a clear Reconnecting banner when the connection drops, then catch up | P0 |
| FR-CONN-5 | Check the Hermes version and contract at connect; refuse unknown combinations with a clear message | P0 |
| FR-CONN-6 | Add and switch between several Hermes servers; switching signs in again | P1 |

### 4.2 Companion plugin (FR-PLG)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-PLG-1 | The plugin registers the `hbapp` delivery platform that writes routine output into a chat without starting a turn, for scheduled runs and for Run now | P0 |
| FR-PLG-2 | The plugin waits until no reply is running in the target chat before writing | P0 |
| FR-PLG-3 | The plugin raises alerts from Hermes hooks and routine deliveries in every bot's profile and serves them on one authenticated WebSocket route | P0 |
| FR-PLG-4 | The app detects a missing or outdated plugin in each bot's profile at connect, installs or updates it through `plugins.manage`, and restarts the gateway once; when the dashboard still runs older plugin code, the update screen shows the exact steps to restart it (manual for now, automated later) | P0 |
| FR-PLG-5 | Optionally publish each alert to an ntfy topic | P1 |
| FR-PLG-6 | At every connect the app sets each bot's `approvals.mode` to `manual` when it differs, so every approval reaches the user and raises an alert; choosing a different mode per bot comes later, from the app | P0 |

### 4.3 Bots (FR-BOT)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-BOT-1 | List every Hermes profile as a bot; a bot created on the server appears on the next load | P0 |
| FR-BOT-2 | Each row shows avatar, name, short description, model, last-message preview, unread, Working and Needs you | P0 |
| FR-BOT-3 | Main bot first, then most recent activity | P0 |
| FR-BOT-4 | Phone home is the bot list; desktop opens the main bot's chat with the list beside it | P0 |
| FR-BOT-5 | Bot info screen; name and description are read-only | P1 |
| FR-BOT-6 | Upload a photo or choose a mark as the bot's avatar, synced across devices | P1 |

### 4.4 Chat (FR-CHAT)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-CHAT-1 | One chat per bot, created on first use and recorded in the profile's `ui_meta["hermes-bots-app"].chat_session_id` right after it is created, with a revision check so every device uses the same chat; alerts come only from this chat | P0 |
| FR-CHAT-2 | Send messages; replies stream in | P0 |
| FR-CHAT-3 | Markdown with tables and code highlighting; Copy on messages and code blocks | P0 |
| FR-CHAT-4 | Stop a running reply | P0 |
| FR-CHAT-5 | Routine output appears in the chat as routine messages, distinct from bot replies | P0 |
| FR-CHAT-6 | Thinking expanded while it streams, then collapsed; one line per tool, collapsed after the reply, tap for input and output | P1 |
| FR-CHAT-7 | Hermes todo list and file diffs | P1 |
| FR-CHAT-8 | Steer a running reply; queue the next message while the bot is busy | P1 |
| FR-CHAT-9 | Retry a reply | P1 |
| FR-CHAT-10 | Attach images and files; paste images from the clipboard | P1 |
| FR-CHAT-11 | Slash commands with autocomplete for Hermes commands without their own control | P1 |
| FR-CHAT-12 | Model and reasoning effort per chat, plus the bot default | P1 |
| FR-CHAT-13 | Summarize (compress) the chat from the header | P1 |
| FR-CHAT-14 | Search within the bot's chat | P1 |
| FR-CHAT-15 | Private handoffs between bots shown as a collapsible card | P1 |

### 4.5 Approvals and questions (FR-ASK)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-ASK-1 | Approval card inline with Allow once, Allow for this chat, Deny; short description with the full command on tap | P0 |
| FR-ASK-2 | The card shows the time left before Hermes auto-denies | P0 |
| FR-ASK-3 | Clarifying questions (up to five) on one card with options and free text, sent together | P0 |
| FR-ASK-4 | A global Needs you list across bots; answering keeps the user's place | P0 |
| FR-ASK-5 | An answer on one device clears the request on the others | P0 |

### 4.6 Routines (FR-RTN)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-RTN-1 | Routine output posts into the bot's chat on schedule without starting a reply | P0 |
| FR-RTN-2 | Replying in the chat sees earlier routine output in context; the bot can change the routine from the chat | P0 |
| FR-RTN-3 | List, create, edit, pause, resume, run now and delete routines, per bot and across all bots | P0 |
| FR-RTN-4 | Schedule picker (daily, weekdays, weekly, once) with an advanced cron option | P0 |
| FR-RTN-5 | Delivery to the bot's chat, an alert, or both | P0 |
| FR-RTN-6 | Run history of outcomes; opening a run scrolls to and highlights its message | P1 |
| FR-RTN-7 | Start from templates | P1 |

### 4.7 Notifications (FR-PUSH)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-PUSH-1 | Alerts for: routine finished, routine failed, approval waiting, question waiting, long reply finished, errors; each toggleable | P0 |
| FR-PUSH-2 | Android: the app's own foreground service keeps the alert connection to the server and posts notifications | P0 |
| FR-PUSH-3 | Android setup guides the user through the battery exemption, an always-on VPN when the server is behind one, and the phone maker's guide | P0 |
| FR-PUSH-4 | Windows: the app stays in the tray and posts its own notifications | P0 |
| FR-PUSH-5 | A tap or click opens the related chat | P0 |
| FR-PUSH-6 | Android ntfy mode as an alternative (server, topic, access token) | P1 |

### 4.8 Sync (FR-SYNC)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-SYNC-1 | All state lives in Hermes; anything a client keeps locally is a copy Hermes can rebuild | P0 |
| FR-SYNC-2 | Read state, pins and other session flags sync across devices through Hermes session fields | P0 |
| FR-SYNC-3 | Other devices refresh when Hermes reports changes | P0 |

### 4.9 Rooms (FR-ROOM)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-ROOM-1 | Rooms where several bots and the user share one channel; a bot addressing another bot is a normal message with an @mention | P1 |

### 4.10 Usage (FR-USE)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-USE-1 | Tokens and cost under each finished reply; chat total in the header | P1 |
| FR-USE-2 | Usage dashboard over the last 14 days, by bot | P1 |

### 4.11 App lifecycle and appearance (FR-APP)

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-APP-1 | Zoetrik look ([DESIGN.md](../../DESIGN.md)); mode follows the system, with Light and Dark overrides | P0 |
| FR-APP-2 | In-app updates from tagged releases of this repository: an Update available prompt with Install or Not now, on both apps | P0 |

---

## 5. UX requirements

The approved [mockups](../../mockups/README.md) are the UI reference for every screen, on phone and desktop. Navigation on the phone is bot list → chat → back. Grok Bot is the reference for look and feel beyond the mockups; only the theme (Zoetrik) and custom avatars differ.

---

## 6. Non-functional requirements

| ID | Area | Requirement | Priority |
| --- | --- | --- | --- |
| NFR-1 | Parity | Every feature ships on Windows and Android together | P0 |
| NFR-2 | Footprint | Lightweight, fast and mature stacks; no heavy runtimes | P0 |
| NFR-3 | Server | Stock Hermes plus the companion plugin; no other server | P0 |
| NFR-4 | Privacy | Alerts carry no conversation text; API keys never reach the app | P0 |
| NFR-5 | Compatibility | Hermes pinned to one tag (v0.22.5); contract and plugin checks pass before any upgrade | P0 |
| NFR-6 | Testing | Development and automated tests run against a separate Hermes test instance, never the live one | P0 |
| NFR-7 | Network | Works at any URL the devices can reach; the reference setup is Tailscale-only, and Android push in foreground-service mode needs the server reachable at all times | P0 |

---

## 7. Tech stack (locked)

| Part | Choice |
| --- | --- |
| Windows app | Tauri v2; UI in React and TypeScript with Vite, Tailwind CSS and shadcn/ui |
| Android app | Kotlin with Jetpack Compose |
| Companion plugin | Python Hermes plugin |
| Client API types | Generated from Hermes's contract at the pinned commit |
| Hermes | v0.22.5, dashboard API on port 9119 |

Reasons are in [WINDOWS-FIRST-STACK.md](../research/WINDOWS-FIRST-STACK.md); the server-side design is in [ARCHITECTURE.md](../research/ARCHITECTURE.md).

---

## 8. Edge cases

| Scenario | Expected behavior |
| --- | --- |
| Routine finishes while a reply is running in its chat | The plugin waits for the reply to finish, then writes the output |
| Approval answered on another device | The card clears here; the outcome shows in the tool result |
| Nobody answers an approval | Hermes denies it after the timeout; the card shows it expired |
| Connection drops mid-reply | Reconnecting banner; on return the chat catches up from replay or refetches history |
| Hermes restarts | The app resumes chats by stored id and refetches |
| Plugin missing or outdated | The app offers to install or update it before routines and push are available |
| Plugin missing in one bot's profile | That bot's routines fail at delivery; the app offers to install the plugin into that profile |
| Plugin updated but the dashboard not restarted | Routines and hooks use the new code after the gateway restart; the update screen shows the exact steps to restart the dashboard for the new alert route |
| Gateway stopped | Scheduled routines do not run; Run now still delivers |
| Android kills the foreground service | Push stops until the app is opened; the setup screen explains the phone maker's settings |
| Hermes version not recognised | The app refuses to connect and says which version it supports |

---

## 9. Acceptance criteria (Alpha exit / MVP)

1. The plugin delivers routine output into a bot's chat without a turn, waits for running replies, and serves authenticated alerts.
2. The app installs or updates the plugin.
3. Login, reconnect and version check work on both apps.
4. Bot list with the required row details and ordering.
5. Each bot's chat streams replies with markdown, copy and stop.
6. Approvals and clarifying questions work inline and from Needs you, and clear across devices.
7. Routines can be listed, created, edited, paused, resumed, run now and deleted; their output lands in the chat and a reply sees it in context.
8. Notifications with the app closed: Android foreground service and Windows tray, with a tap opening the chat.
9. Both apps update themselves from tagged releases.
10. Read state and session flags stay in sync between a phone and a PC.
11. All of the above work the same on Windows and Android.

---

## 10. Open questions

Where **Decision** is filled, that ruling is final. Empty **Decision** means still open; **Default assumption** applies until decided.

| # | Question | Impact | Default assumption if unanswered | Decision |
| --- | --- | --- | --- | --- |
| Q1 | How are rooms built on Hermes? | FR-ROOM | Investigate before Beta work on rooms | |
| Q2 | How do private handoffs between bots work outside Bot Chat (`message_agent` is Bot Chat only)? | FR-CHAT-15 | Investigate before Beta | |
| Q3 | Where are custom avatars stored so every device sees them? | FR-BOT-6 | Profile `ui_meta`, size-limited | |
| Q4 | Where do app updates come from? | FR-APP-2 | GitHub releases of this repository | **Only from tagged releases** |
| Q5 | How are the Windows installer and Android APK signed? | Install trust, in-app updates | Windows code signing decided later; unsigned builds show a SmartScreen warning on first install | **Android signing key and Tauri update key created in M2 and kept as GitHub secrets** |
| Q6 | The open design questions in the mockups README | UI details | Mockup behaviour as shown | |

---

## 11. Out-of-scope backlog

- Pages and a per-bot Library (Post-stable, likely)
- Desktop-first notification routing and avatar-as-status (Post-stable, considered)
- Creating and editing bots from the app (Post-stable, considered)
- Always allow for approvals (Post-stable, considered)
- Message reactions, edit and resend, voice input, read aloud, export a chat (Post-stable, considered)
- Bot memory, skills, tools, MCP servers, bot settings, background processes, files, projects and logs (Post-stable, considered)
- Search across all bots (Post-stable, considered)

---

## 12. Document history

| Version | Date | Notes |
| --- | --- | --- |
| 1.0 | 2026-10-30 | Draft PRD from the planning answers, approved mockups, architecture and feasibility findings |
| 1.1 | 2026-10-31 | Companion plugin requirements per bot profile, Run now delivery, plugin update restarts |
| 1.2 | 2026-11-03 | The app sets each bot's approval mode to manual at setup; alert for a failed reply; alerts only from each bot's app chat |

# Hermes Bots mockups

Static, clickable mockups of the Hermes Bots client. They are for approval before any real client is built. They do not connect to Hermes. Sample data only.

Honest Terminal and Zoetrik load Geist Mono, Orbitron, Tomorrow, Inter, and Fragment Mono from Google Fonts. Original uses the system font and does not need the network.

## How to view

From the repository root:

```bash
python3 -m http.server 8000 --directory mockups
```

Open `http://127.0.0.1:8000/`. The index lists every screen. Each one is shown in a phone frame (390 CSS pixels wide) and a desktop window (1280 CSS pixels wide). The two frames are separate pages. A click stays inside the frame you clicked.

`app.html` is the client itself. The index loads it with `?device=phone` or `?device=desktop` and a hash for the screen. Opening `app.html` directly picks phone or desktop from the window width.

Two controls sit on the index and again in Settings. Look is Original, Honest Terminal, or Zoetrik. Mode is System, Light, or Dark. Both are stored in this browser and shared with the frames.

## Screens

1. **Desktop shell and phone list.** Bots beside the chat on the desktop. Junior (the main profile) pinned first, then recent activity. Each row shows a face, name, short description, model, last-message preview, and unread, working, or needs-you when those apply. Needs you is its own list. Rooms are a separate section. On the phone the list is the home screen: tap a bot, then Back. The bot row opens that bot's one main chat.
2. **Bot chat.** Markdown, a table, a code block with Copy, a collapsed thinking block, collapsed tool lines (tap for input and output), a todo list, a file diff, per-reply tokens and cost, and Retry. A routine message is in the thread, and the next message replies to it in context. Earlier routine runs are earlier messages in the same chat. A private handoff is a short note, collapsed until you tap it. Summarize is in the header.
3. **Working turn.** Thinking stays expanded while the reply streams. One line per tool. Stop ends the turn. Steer adds a note without stopping. The queued line waits until this turn finishes. Type in the box and it offers Queue.
4. **Attachments and a pasted image.** An image already in the thread, plus a pasted image and a file waiting in the box.
5. **Model and reasoning.** Open from the chip on the composer. Pick a model and a reasoning effort. This chat changes only the open thread. Bot default changes the bot everywhere a chat has not picked its own.
6. **Reconnecting.** A banner, then a caught-up state.
7. **Approval.** Allow once, Allow for this chat, or Deny. The short line is the description; Full command shows the exact command. The timer is the five-minute auto-deny. The same item is in Needs you. Answering keeps your place in the thread.
8. **Clarifying questions.** Up to five questions on one card. Each has options and a free-text line. Choosing an answer keeps the scroll position, including inside the card.
9. **Side chats and history.** Search within the bot, pin, rename, archive, delete, auto titles. The main chat is the only place routines post. New side chat starts empty.
10. **Routines for one bot.** Pause, resume, run now, edit, history. Run now appends a message to that bot's main chat.
11. **All routines.** The same list, grouped by bot.
12. **New routine.** Templates, schedule picker, advanced cron, delivery to the bot's chat and/or an alert.
13. **Edit routine.** The morning briefing, ready to change.
14. **Run history.** One row per run. Open jumps to that run's message in the main chat and highlights it. A failed run has no message.
15. **Group room.** Standup has three bots in one channel. A line between bots is marked Between bots. A private handoff that never entered a room is not listed here.
16. **Usage.** Cost on each reply, a total on the chat, and a 14-day dashboard by bot and by chat.
17. **Bot info and avatar.** Upload a photo or choose a mark. Name and description are shown, not edited.
18. **Servers.** Add a server, switch server. Look and mode live here too.
19. **Notifications.** Notification server and topic. On the phone the status line is UnifiedPush registered with ntfy on devbox, and a sample alert opens Junior's briefing. On Windows the status line is the app's own tray, and the same sample opens the same message.
20. **Login.** Shown when the session expires, with the username already filled in.
21. **Update available.** Install, or Not now.

## What a click does

The sample roster is Junior (main), Nightwatch, Ledger, Atlas, Quartermaster, and Scribe, plus the Standup and House rooms. Ledger is waiting on an approval. Atlas is waiting on questions. Nightwatch is mid-reply.

Sending a message adds it to the thread and appends a short sample reply. Run now on a routine appends one message to that bot's main chat and adds a history row that points at it. Stop settles Nightwatch's turn. The approval timer counts down and, at zero, denies on its own. Choosing an option, expanding a tool, or retrying a reply does not jump the thread back to the top. Upload a photo uses a file on this device only. Nothing is sent anywhere.

There is no slash menu. A new side chat is on the history screen. Routines are in the list. The model chip sets model and effort. Stop is on the composer while a turn is running. Summarize is in the chat header.

## Decisions already made in these screens

- Phone home is the bot list. Desktop home is Junior's main chat, with the list still visible.
- Each bot has one main chat. Every routine run posts into that chat. Side chats do not receive routines. History never creates a chat per run.
- Run history is outcomes. Open scrolls to the message and highlights it.
- Approval offers Allow once, Allow for this chat, and Deny. There is no always-allow.
- The approval card shows the time left until the five-minute auto-deny.
- Clarifying questions are one card. They are sent together. Answering does not reset scroll.
- While the app is open, Needs you is the sidebar list, the badges, and the inline cards.
- Alerts when the app is closed: Android uses self-hosted ntfy on devbox through UnifiedPush, so the notification is Hermes Bots and a tap opens the chat. Windows shows the app's own tray notification for the same events.
- Switching server opens sign-in again. The username stays filled in.
- Chats from other clients are not listed.
- Bot name, description, and tools are not editable. The avatar is. Creating a bot is not on screen.
- A room is one shared channel. Bot-to-bot lines in that room stay marked Between bots. A private handoff outside any room is a collapsed note in each bot's chat, labeled "Junior → Ledger".
- Cost sits under every finished reply, and the chat header shows the thread total.
- Archived chats sit behind Show archived on that bot.
- Reading width is about 720 pixels. The phone has an Android status bar. The desktop window has a caption bar. Honest Terminal adds a green status strip under the desktop window, and turns the phone status bar green. Those are the one green slab in that look.
- Model names in the picker are samples.
- Original is the first mock, kept so the three looks can be compared. Honest Terminal dark and Zoetrik dark follow the flavor specs. Their light variants are derived: Honest Terminal light uses that flavor's Teletype paper scheme, and Zoetrik light uses its Drafting Table scheme.

## Changes after the first review

- Slash commands are gone. Summarize replaced the one command that had no button.
- Cards and rows keep the scroll position when you interact with them.
- Routine history opens the message inside the one main chat.
- Private handoffs are inline notes. Rooms are unchanged.
- Notifications describe UnifiedPush on Android and tray notifications on Windows.
- Honest Terminal and Zoetrik sit beside Original, with light and dark for each.

## Open design questions

1. Is the phone home the bot list, with Junior opened only after a tap? Desktop already opens Junior.
2. Should a routine ever post into a side chat, or only into the main chat? These screens post only into the main chat.
3. Is highlighting the run's message enough, or should the history row also quote the message?
4. Is "Allow for this chat" the right label for the session choice?
5. Should the five-minute countdown be visible the whole time, or only near the end?
6. Should the five questions stay one scrolling card, or become one question at a time?
7. While the app is open, are the Needs you list and the inline cards enough, or do you also want a toast?
8. Is one ntfy topic right for the phone's UnifiedPush subscription, or do you want a topic per bot?
9. When you switch server, is a fresh password required?
10. Should Discord and CLI history stay completely absent, with no import entry?
11. When a bot is created on the server, is it enough that it appears on the next load of the list, with no toast?
12. Is the collapsed "Junior → Ledger" note the right weight for a private handoff, or should it stay expanded?
13. Is a cost line under every reply too noisy?
14. Are archived chats in the right place (behind Show archived, still inside that bot)?
15. Steer adds a note and does not stop the turn. Stop ends it. A queued message waits. Is that the right trio?
16. Which look should the app ship with: Original, Honest Terminal, or Zoetrik? The light variants are derived from each flavor's published light scheme. Are those acceptable, or do you only want the dark versions?

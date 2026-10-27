# Hermes Bots mockups

Static, clickable mockups of the Hermes Bots client. They are for approval before any real client is built. They do not connect to Hermes. They ship with sample data and no external assets, so they work offline over Tailscale.

## How to view

From the repository root:

```bash
python3 -m http.server 8000 --directory mockups
```

Open `http://127.0.0.1:8000/`. The index lists every screen. Each one is shown in a phone frame (390 CSS pixels wide) and a desktop window (1280 CSS pixels wide). The two frames are separate pages. A click stays inside the frame you clicked.

`app.html` is the client itself. The index loads it with `?device=phone` or `?device=desktop` and a hash for the screen. Opening `app.html` directly picks phone or desktop from the window width.

Theme follows the system setting. The control on the index, and the one in Settings, can force light or dark. The choice is stored in this browser only.

## Screens

1. **Desktop shell and phone list.** Bots beside the chat on the desktop. Junior (the main profile) pinned first, then recent activity. Each row shows a face, name, short description, model, last-message preview, and unread, working, or needs-you when those apply. Needs you is its own list. Rooms are a separate section. On the phone the list is the home screen: tap a bot, then Back.
2. **Bot chat.** Markdown, a table, a code block with Copy, a collapsed thinking block, collapsed tool lines (tap for input and output), a todo list, a file diff, per-reply tokens and cost, and Retry. A routine message is in the thread, and the next message replies to it in context.
3. **Working turn.** Thinking stays expanded while the reply streams. One line per tool. Stop, steer, and a queued message sit on the composer.
4. **Slash commands.** Autocomplete above the box. The list filters as you type.
5. **Attachments and a pasted image.** An image already in the thread, plus a pasted image and a file waiting in the box.
6. **Model and reasoning.** Per chat, or as the bot's default.
7. **Reconnecting.** A banner, then a caught-up state.
8. **Approval.** Allow once, Allow for this chat, Deny. Short description, full command on tap, five-minute auto-deny countdown. The same item is in the global Needs you list.
9. **Clarifying questions.** Up to five questions, options plus a free-text line.
10. **Side chats and history.** Search within the bot, pin, rename, archive, delete, auto titles. The main chat is kept.
11. **Routines for one bot.** Pause, resume, run now, edit, history.
12. **All routines.** The same list, grouped by bot.
13. **New routine.** Templates, schedule picker, advanced cron, delivery to the bot's chat and/or ntfy.
14. **Edit routine.** The same form, filled in.
15. **Run history.** Succeeded or failed, and a way to open the chat message. The message is the output.
16. **Group room.** Several bots. Bot-to-bot lines are labeled Between bots and name both sides.
17. **Usage.** Cost on each reply, a total on the chat, and a 14-day dashboard by bot and by chat.
18. **Bot info and avatar.** Upload a photo or choose a mark. The face is used everywhere that bot appears.
19. **Servers.** Add a server, switch server. Switching returns to the sign-in screen.
20. **Notifications.** ntfy server, topic, and a switch per alert.
21. **Login.** Shown when the session expires, with the username already filled in.
22. **Update available.** Install, or Not now.

## What a click does

The sample roster is Junior (main), Nightwatch, Ledger, Atlas, Quartermaster, and Scribe, plus the Standup and House rooms. Ledger is waiting on an approval. Atlas is waiting on questions. Nightwatch is mid-reply.

Sending a message adds it to the thread and appends a short sample reply. Run now on a routine appends a routine message to that bot's main chat. Stop settles Nightwatch's turn. The approval timer counts down and, at zero, denies on its own. Upload a photo uses a file on this device only. Nothing is sent anywhere.

## Decisions already made in these screens

- Phone home is the bot list. Desktop home is Junior's main chat, with the list still visible.
- Routines post only into that bot's main chat. Side chats do not receive them.
- Run history is a list of outcomes. The output is the message in the chat, not a separate log.
- Approval offers Allow once, Allow for this chat, and Deny. There is no always-allow.
- The approval card shows the time left until the five-minute auto-deny.
- Clarifying questions are one card. They are sent together.
- While the app is open, Needs you is the sidebar list, the badges, and the inline cards.
- ntfy is one topic, with a switch for each alert type.
- Switching server opens sign-in again. The username stays filled in.
- Chats from other clients are not listed.
- Bot name, description, and tools are not editable. The avatar is. Creating a bot is not on screen.
- A bot-to-bot line names both bots and says Between bots. A line to you names only the speaker.
- Cost sits under every finished reply, and the chat header shows the thread total.
- Archived chats sit behind Show archived on that bot.
- Reading width is about 720 pixels. The phone has an Android status bar. The desktop window has a caption bar.
- Model names in the picker are samples.

## Open design questions

1. Is the phone home the bot list, with Junior opened only after a tap? Desktop already opens Junior.
2. Should a routine ever post into a side chat, or only into the main chat?
3. Is run history complete if each row is an outcome plus Open in chat, with no log text of its own?
4. Is "Allow for this chat" the right label for the session choice?
5. Should the five-minute countdown be visible the whole time, or only near the end?
6. Should the five questions be one scrolling card, or one question at a time?
7. While the app is open, are the Needs you list and the inline cards enough, or do you also want a toast?
8. Is one ntfy topic right, or do you want a topic per bot?
9. When you switch server, is a fresh password required?
10. Should Discord and CLI history stay completely absent, with no import entry?
11. When a bot is created on the server, is it enough that it appears on the next load of the list, with no toast?
12. Is Between bots clear enough in a room, or should those lines sit in a different column?
13. Is a cost line under every reply too noisy?
14. Are archived chats in the right place (behind Show archived, still inside that bot)?
15. Steer adds a note and does not stop the turn. Stop ends it. A queued message waits. Is that the right trio?

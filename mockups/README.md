# Botsman mockups

Static, clickable mockups of the Botsman apps. They connect to nothing and use sample data only.

The look is Zoetrik, using the tokens in the shadcn/ui section of `DESIGN.md`. Orbitron, Inter, and Fragment Mono load from Google Fonts. Dark is the Zoetrik palette, and light is its Drafting Table scheme. Mode is System, Light, or Dark, stored in this browser as `hb-theme`, and set from Settings as in the apps.

The Windows app and the web dashboard use these screens directly. The web dashboard has no tray, and shows notifications only while the site is open. The Android app is rebuilt in native views, using them as the visual reference.

## How to view

```bash
python3 -m http.server 8000 --directory mockups
```

Open `http://127.0.0.1:8000/`. The index lists every screen in a phone frame (390 pixels wide) and a desktop window (1280 pixels wide). A click stays inside the frame you clicked.

`mockups/app.html` is the client itself. The index loads it with `?device=phone` or `?device=desktop` and a hash for the screen. Opened directly, it picks phone or desktop from the window width.

## Screens

1. **Desktop shell and phone list.** Bots beside the chat on the desktop. The main bot is pinned first, then recent activity. Needs you has its own list, and channels are a separate section. On the phone the list is the home screen.
2. **Bot chat.** Markdown, a table, a code block with Copy, a todo list, a file diff, and each run's tokens and cost with Copy. A run's thinking, tool calls, and subagent work fold into one line such as "Thought · ran 2 tools", which opens to them. A routine result is in the thread, and the next message replies to it. A line such as Junior → Nightwatch opens that bot conversation.
3. **Working turn.** The fold says what is running. The message box asks to queue a message, with Queue, Steer, and Stop beside the model chip. A queued message waits greyed at the end of the chat.
4. **Attachments and a pasted image.**
5. **Model and reasoning.** The model chip on the message box opens it. This chat changes only the open thread. Bot default changes the bot everywhere a chat has not picked its own. The chat header shows the model, the effort, and how full the context is.
6. **Slash commands.** Compact, clear, skills, memory, notes, and usage.
7. **Reconnecting.** A banner, then a caught-up state.
8. **Approval.** Allow once, Allow for this chat, or Deny, with why it is asking, the full command, and the time left. The same item is in Needs you.
9. **Clarifying questions.** Up to five questions on one card.
10. **Routines for one bot.** Pause, resume, run now, edit, history. A routine a bot created says so.
11. **All routines.** The same list, grouped by bot.
12. **New routine.** Templates, schedule picker, advanced cron, delivery, and the memory toggle, off by default.
13. **Edit routine.**
14. **Run history.** Open jumps to that run's message and highlights it.
15. **Channel.** Standup has three bots. A bot replies only when mentioned or asked.
16. **Usage.** Cost on each reply, a total on the chat, and a 14-day dashboard by bot.
17. **Bot info.** Edit name and description, choose an avatar, and open memory, notes, settings, and routines. Delete marks the bot as deleted on the server and removes it from the apps. The main bot can restore it.
18. **Servers.** Add a server at any HTTPS address, switch server, and set the mode.
19. **Settings.** Alert switches that apply to every device, the background connection (on the phone with its checklist, on Windows the tray and Start with Windows), signed-in devices, Mode, model providers, and the app's version with Check for updates.
20. **New bot.** Name, description, purpose, default model, and a folder that defaults to `~/.botsman/workspaces/<id>`, with free space on the server. Unsafe paths are refused.
21. **Memory.** `USER_PROFILE.md`, `USER_MEMORY.md`, `BOT_PROFILE.md`, and `BOT_MEMORY.md`, each read-only until Edit, with character counts, and pending edits shown as a diff to confirm or reject.
22. **Notes.** Keyword search and a list of a bot's notes.
23. **One note.** Read-only until Edit, then save; or delete. A new note opens ready to write.
24. **Bot settings.** Permission mode, approval wait, network, connections, and skills. Botsman and server skills start off, and a bot's own skills are always on.
25. **Bot settings for the main bot.** The same, plus the server shell switch, which is off by default, and adding connections.
26. **One bot chat.** Opened from its line in a bot's chat, and read-only until you step in. There is no separate list.
27. **A paused bot chat.** Pauses after 10 messages without you, and the line says Paused.
28. **Model providers.** Every provider and its status, with Connect, Replace, and Remove. Saved keys and sign-ins can't be viewed.
29. **Signing in to a provider.** An API key or a browser sign-in with a pasted address or code. GitHub Copilot shows a code. Anthropic's Claude subscription option finds an existing Claude Code login on the server, or shows the command to sign in, with an optional program path, login folder, and Usage label.
30. **Restoring a deleted bot.** The main bot's card, with Restore or Keep deleted.
31. **Subagent work.** One line alongside the tool lines, which opens to the task and the work so far.
32. **First-run setup.** The server's address, then the owner password and the main bot's name, then a model provider, which can be skipped.
33. **Login.** Shown when a session expires, with the username filled in.
34. **Update available.** Install, or Not now.

## Sample data

The roster is Junior (main), Nightwatch, Ledger, Atlas, Quartermaster, and Scribe, plus the Standup and House channels. Ledger is waiting on an approval, Atlas on questions, and Junior and Nightwatch on memory confirmations. Nightwatch is mid-reply. Model names are samples.

## Decisions in these screens

- Phone home is the bot list. Desktop home is the main bot's chat, with the list still visible.
- Each bot has one chat with the owner. Every routine run posts into it without starting a reply.
- Approvals have no always-allow.
- Clarifying questions are one card, sent together.
- Switching server opens sign-in again, with the username filled in.
- Cost sits under every finished reply, and the chat header shows the thread total.
- Reading width is about 720 pixels.
- Zoetrik is the only look.

## Open design questions

The mockup behaviour applies until one of these is decided.

1. Should the phone open on the bot list, with the main bot opened only after a tap?
2. Is highlighting a run's message enough, or should the history row also quote it?
3. Is "Allow for this chat" the right label?
4. Should the approval countdown be visible the whole time, or only near the end?
5. Should clarifying questions stay one scrolling card, or become one at a time?
6. While the app is open, are Needs you and the inline cards enough, or is a toast also wanted?
7. When you switch server, is a fresh password required?
8. Is a cost line under every reply too noisy?
9. Steer adds a note, Stop ends the turn, and a queued message waits. Is that the right trio?

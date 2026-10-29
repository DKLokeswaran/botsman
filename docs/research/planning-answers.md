# Planning answers

Answers to the planning questionnaire (submitted 2026-10-27 23:13 IST). Quoted verbatim.

```text
## You & the goal | Who will use this app?
  A: "Just me"
## You & the goal | In your own words, what should this app fix compared to talking to Hermes on Discord today?
  A: "one discord is built to be a chat app. so however we may try, we cannot make discord a good frontend. what i want is grok bot ui style frontend. the hermes web dashboard is too admistorial like. i want a user firendly and grok bot -closne/similar exp"
## You & the goal | Where will you use it most?
  A: "About equally"
## You & the goal | What do you mostly use Hermes for?
  A: ["Other"]
  OTHER: you can ask hermes migration for current usecases, but i'll state the goal/final state. what i want is to fully replicate my grok bot setup there
## You & the goal | Pick up to 3 things v1 must absolutely nail.
  A: ["Great on phone", "Great on Windows", "Looks beautiful (Grok Bot feel)"]
## You & the goal | How do you want v1 paced?
  A: "No rush, get it right"
## Platforms & where it runs | What phone do you use?
  A: "Android"
## Platforms & where it runs | On Windows, what form should it take?
  A: "Installable desktop app (.exe, own window)"
## Platforms & where it runs | On your phone, what form should it take?
  A: "Native app (Android APK / iPhone app)"
## Platforms & where it runs | If it's a web app: OK to run a small web server on devbox (Tailscale-only, under my bots folder) that serves the app and forwards to Hermes?
  A: "Doesn't apply / skip"
## Platforms & where it runs | Only if you picked iPhone + native: OK paying Apple's ~$99/year developer fee?
  A: "Doesn't apply / skip"
## Platforms & where it runs | Is it fine that the app only works when your device is on Tailscale?
  A: "Yes, Tailscale-only is fine"
## Platforms & where it runs | How should new versions reach you?
  A: "Tell me there's an update, I click to install"
## Login & connection | How should logging in work?
  A: "Log in once per device and stay logged in as long as possible"
## Login & connection | When the login does expire, what should happen?
  A: "Show the login screen with my username pre-filled"
## Login & connection | Which Hermes server(s) should the app connect to?
  A: "A settings screen where I can add/switch Hermes servers"
## Login & connection | When the connection drops (e.g. phone sleeps, Wi-Fi switch), what should you see?
  A: "Show a clear 'reconnecting' banner, then catch up"
## Login & connection | With no connection at all, should old chats still be readable?
  A: "No, online-only is fine"
## Notifications | Do you want alerts on your phone when the app is closed?
  A: "Yes, via ntfy (a simple push app)"
## Notifications | What should alert you? (when the app is closed)
  A: ["A routine finished", "A routine failed", "An approval is waiting", "A question is waiting for me", "A long reply finished", "Errors"]
  NOTE: and anythign that grok bot pc app/ui/mobile app does
## Notifications | While the app is open, which in-app signals do you want?
  A: "(skipped)"
  NOTE: I dont understand this question
## Bots sidebar | How should conversations per bot work?
  A: "Main chat per bot, plus the option to start side chats"
## Bots sidebar | What should each bot row in the sidebar show?
  A: ["Avatar", "Name", "Short description", "Model it uses", "Unread badge", "'Working…' indicator", "'Needs you' indicator (approval/question)"]
  NOTE: if possible try and fit last message preview as well. if not leave it
## Bots sidebar | How should bots be ordered?
  A: "Most recent activity first"
  NOTE: with the bot connecting to the main/default profile always at the top
## Bots sidebar | Should you be able to create or edit bots (profiles) from the app?
  A: "(skipped)"
  NOTE: not for now, but definitely in the pipeline. also tell me what if i use the frontend to direct the agent server to create the bot, in that case will the frontend pick it up automatically?
## Bots sidebar | Which bot opens when you launch the app?
  A: "(skipped)"
  NOTE: the main-junior bot
## Chat features | Chat features: must-have now, later, or never?
  A: {"Streaming replies (text appears as it's written)": "Nice later", "Markdown, tables and code highlighting": "Must-have in v1", "Copy button on messages/code": "Must-have in v1", "Show the model's thinking/reasoning": "Nice later", "Live tool activity (what Hermes is running)": "Nice later", "Sub-agent activity": "Nice later", "Hermes' todo list for the task": "Must-have in v1", "File diffs when Hermes edits files": "Must-have in v1", "Stop button": "Must-have in v1", "Steer: add instructions while it's working": "Must-have in v1", "Queue my next message while it's busy": "Must-have in v1", "Retry / regenerate a reply": "Must-have in v1", "Edit and resend my last message": "Nice later", "Branch/fork a chat from a point": "(skipped)", "Slash commands with autocomplete": "Must-have in v1", "Attach images / screenshots": "Must-have in v1", "Attach PDFs and other files": "Must-have in v1", "Paste images from clipboard": "Must-have in v1", "Voice input (speak instead of type)": "Nice later", "Read replies aloud": "Nice later", "Switch model per chat": "Must-have in v1", "Switch reasoning effort per chat": "Must-have in v1", "Token / cost shown per reply": "Must-have in v1", "Export a chat": "Nice later"}
  NOTE: reacting to messages like in gork bot - nice later
pages like grok bot - nice later
bot channels and bot to bot msg ui - must have
## Chat features | If thinking is shown, how?
  A: "Expanded while it streams, then collapses"
## Chat features | How much detail for tool activity?
  A: "One line per tool (e.g. 'Ran: git status'), tap for full input/output"
  NOTE: tool activity must alse be collapsed like thinking after the final output is done
## Chat features | Model choice should be set…
  A: "Both"
## Approvals & questions | Hermes offers these approval choices. Which buttons should the card show?
  A: ["Allow once", "Allow for this chat", "Deny"]
  NOTE: lets keep always allow after the v1
## Approvals & questions | How much should an approval card show?
  A: "A short description, tap to see the full command"
## Approvals & questions | Where should approvals and questions appear?
  A: "Inline, plus a global 'needs you' list"
## Approvals & questions | Hermes auto-denies after 5 minutes if nobody answers. Is that OK?
  A: "Yes, fine"
## Approvals & questions | Clarifying questions (Hermes can ask up to 5 at once, with or without options):
  A: "Show them as a card with clickable options plus a free-text box"
## Session history | History features: must-have now, later, or never?
  A: {"Search across all chats (full text)": "Nice later", "Search within one bot": "Must-have in v1", "Auto titles": "Must-have in v1", "Rename": "Must-have in v1", "Pin / favourite": "Must-have in v1", "Archive (hide but keep)": "Must-have in v1", "Delete": "Must-have in v1", "Bulk delete": "Nice later", "Group by date (Today / Yesterday / …)": "Nice later", "Export a chat": "Nice later"}
## Session history | Should chats you had with Hermes elsewhere (Discord, the Hermes CLI) also appear in history, where Hermes allows?
  A: "No, only chats from this app"
## Routines | Routine features: must-have now, later, or never?
  A: {"List routines": "Must-have in v1", "Pause / resume": "Must-have in v1", "Run now": "Must-have in v1", "Edit": "Must-have in v1", "Create new": "Must-have in v1", "Delete": "Must-have in v1", "Run history": "Must-have in v1", "See a run's output": "Must-have in v1", "Start from templates": "Must-have in v1", "Choose where results are delivered": "Must-have in v1"}
  NOTE: wait what do mean see a run;s output? i want it like grok bot, it should message me in a chat as per the routitne schedule. see fucking remember this, i dont want just a frontend for hermes. i want grok bot style front end. that is the entire fucking reason for this project
## Routines | Where should routines live in the app?
  A: "Both"
## Routines | Where do you want routine results to go?
  A: ["Into the app (that bot's chat)", "ntfy"]
## Routines | How should you set a schedule?
  A: "Picker with an 'advanced: cron' option"
## Other Hermes features | Other features: must-have now, later, or never?
  A: {"View/edit a bot's memory": "Nice later", "Browse/edit a bot's skills": "Nice later", "Install skills from the Hermes hub": "Nice later", "Turn tools/toolsets on or off": "Nice later", "Manage MCP servers": "Nice later", "Bot settings (config)": "Nice later", "Usage & cost per chat": "Must-have in v1", "Usage dashboard over time": "Must-have in v1", "See/kill background processes": "Nice later", "Browse files on devbox": "Nice later", "Projects / workspaces": "Nice later", "Multi-bot group rooms": "Must-have in v1", "Hermes logs": "Nice later"}
## Look & feel | What do you like most about Grok Bot's UI that this should copy?
  A: "everything. only change i want is i should be able to upload/choose my own avatars"
## Look & feel | Anything about Grok Bot's UI you dislike or want different?
  A: "yes i want to chooe my custom avatar"
## Look & feel | Theme?
  A: "Follow my system setting"
## Look & feel | Accent colour?
  A: "Neutral / monochrome like Grok Bot"
## Look & feel | Density?
  A: "Not sure / you decide"
## Look & feel | On the phone, how should you move around?
  A: "Bots list → tap → chat (like WhatsApp)"
## Coming from Discord | What annoys you about using Hermes in Discord?
  A: "I cannot reply to a automation message with it in the context like i do wtih grok bot. also using it doenst give the feel of using a pa app"
## Coming from Discord | After v1, will you still use Discord with Hermes?
  A: "No, I want to switch fully"
  NOTE: i'll only switch fully if i have enogh confidence wtih both mobile and android app
## Privacy & security | What may the app store on your devices?
  A: "Only the login, nothing else"
## Privacy & security | App lock on top of the Hermes login?
  A: "Doesn't apply / skip"
## Privacy & security | Hermes can show and edit its API keys. Should the app ever expose them?
  A: "Never, keep keys out of the app"
## How we work & done | How do you want to review progress?
  A: ["A preview link on devbox I can try", "Screenshots in chat", "A short screen recording"]
## How we work & done | How often should I check in?
  A: "After each feature"
## How we work & done | Before building, do you want to see mockups?
  A: "Yes, show me mockups to approve first"
## How we work & done | Where should the code live?
  A: "Private GitHub repo (DKLokeswaran)"
## How we work & done | v1 is done when I can…
  A: "chat with my bots on both phone and windows, get notifictionas"
```

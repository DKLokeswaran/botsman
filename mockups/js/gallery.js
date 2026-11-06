/* Builds the review page: every screen, phone and desktop. */
(function () {
  const screens = [
    {
      id: "shell",
      title: "Desktop shell and phone list",
      blurb: "On the desktop the bot list stays beside the open chat. Junior, the main bot, stays pinned at the top. The rest follow recent activity. Each row has a face, a short description, the model, a preview, and any unread, working, or needs-you mark. Needs you sits above the bots. Channels are their own section. New bot sits under the bot list. On the phone the list is the home screen: tap a bot to open the chat, and Back returns.",
      phone: "#/bots",
      desk: "#/chat/junior"
    },
    {
      id: "chat",
      title: "Bot chat",
      blurb: "Junior's chat. A routine posted the morning briefing, and the reply under it quotes that message. Older runs of that routine are earlier in the same chat. A line such as Junior → Nightwatch marks a conversation between bots, and clicking it opens that conversation. It adds nothing to this chat's context. Scroll for the table, the todo list, the file diff, and a code block with Copy. Finished replies show tokens, cost, and Retry. Thinking and tool lines are collapsed; tap one to open it. Summarize is in the header.",
      phone: "#/chat/junior",
      desk: "#/chat/junior"
    },
    {
      id: "working",
      title: "Working turn",
      blurb: "Nightwatch is mid-reply. Thinking stays open while it streams. Each tool is one line; the one still running is marked. Stop ends the turn. Steer adds a note without stopping. The queued line waits until this turn finishes. Type in the box and it offers Queue.",
      phone: "#/chat/nightwatch",
      desk: "#/chat/nightwatch"
    },
    {
      id: "attach",
      title: "Attachments and a pasted image",
      blurb: "A pasted image is already in the thread. The box holds another pasted image and a file, ready to send. The paperclip picks a file. The image button drops in a sample paste. A real image paste from the clipboard works too.",
      phone: "#/chat/junior?view=attach",
      desk: "#/chat/junior?view=attach"
    },
    {
      id: "model",
      title: "Model and reasoning",
      blurb: "Open from the chip on the composer. Pick a model and a reasoning effort. This chat changes only the open thread. Bot default changes the bot everywhere a chat has not picked its own.",
      phone: "#/chat/junior?view=model",
      desk: "#/chat/junior?view=model"
    },
    {
      id: "slash",
      title: "Slash commands",
      blurb: "Type / in the message box, or tap the / button. The menu filters as you type and moves with the arrow keys. Enter runs the highlighted command. These are commands without their own control: compact, clear, skills, memory, notes, usage, and help. Model, Stop, and routines stay as buttons. Summarize in the header does the same thing as /compact.",
      phone: "#/chat/junior?view=slash",
      desk: "#/chat/junior?view=slash"
    },
    {
      id: "reconnect",
      title: "Reconnecting",
      blurb: "The banner stays up until the link returns. Retry plays the caught-up state, then the banner goes away.",
      phone: "#/chat/junior?view=reconnect",
      desk: "#/chat/junior?view=reconnect"
    },
    {
      id: "approval",
      title: "Approval",
      blurb: "Allow once, Allow for this chat, or Deny. The short line is the description; Full command shows the exact command. A line says why it is asking. The timer counts down this bot's approval wait, 1 hour by default. The same item is in Needs you. Answering clears it in both places.",
      phone: "#/chat/ledger",
      desk: "#/chat/ledger"
    },
    {
      id: "clarify",
      title: "Clarifying questions",
      blurb: "Five questions on one card. Each has options and a free-text line. The first accepts more than one choice. Send answers clears it from Needs you.",
      phone: "#/chat/atlas",
      desk: "#/chat/atlas"
    },
    {
      id: "routines-bot",
      title: "Routines for one bot",
      blurb: "Junior's routines. Pause or resume, run now, edit, and history are on each card. Run now posts a message into that bot's chat.",
      phone: "#/routines/junior",
      desk: "#/routines/junior"
    },
    {
      id: "routines",
      title: "All routines",
      blurb: "Every bot, grouped. Same actions as the per-bot list.",
      phone: "#/routines",
      desk: "#/routines"
    },
    {
      id: "routine-new",
      title: "New routine",
      blurb: "A template fills the form. The schedule is a picker: daily, weekdays, weekly, or once. Advanced: cron reveals the expression that will be saved. Delivery is this bot's chat, an alert, or both. The alert comes from the app's background connection on the phone and is a tray notification on Windows. The memory toggle is off by default, so a routine runs with its instructions only.",
      phone: "#/routine/new?bot=junior",
      desk: "#/routine/new?bot=junior"
    },
    {
      id: "routine-edit",
      title: "Edit routine",
      blurb: "The morning briefing, ready to change. Same form, plus pause, run now, history, and delete.",
      phone: "#/routine/edit/morning",
      desk: "#/routine/edit/morning"
    },
    {
      id: "runs",
      title: "Run history",
      blurb: "Outcomes only. Each bot has one chat. A successful run opens that chat and highlights the message that run posted. A failed run posted nothing, so it has no Open.",
      phone: "#/routine/runs/morning",
      desk: "#/routine/runs/morning"
    },
    {
      id: "room",
      title: "Channel",
      blurb: "Standup is one shared channel. Every member receives every message. A bot replies only when mentioned or when you ask. House is the other channel.",
      phone: "#/room/standup",
      desk: "#/room/standup"
    },
    {
      id: "usage",
      title: "Usage",
      blurb: "Spend over the last 14 days, then by bot. Per-reply cost stays on the reply itself. The chat header also shows the open chat's total.",
      phone: "#/usage",
      desk: "#/usage"
    },
    {
      id: "bot",
      title: "Bot info",
      blurb: "Edit the name and description. Upload a photo or choose a mark, and the face updates on the list, in the chat, and in channels. Links lead to memory, notes, settings, routines, and bot chats. The main bot cannot be deleted; other bots can.",
      phone: "#/bot/junior",
      desk: "#/bot/junior"
    },
    {
      id: "settings",
      title: "Servers",
      blurb: "Saved servers, at any HTTPS address. Add one, or use another. Switching opens the sign-in screen with the username already filled in. Mode is System, Light, or Dark.",
      phone: "#/settings",
      desk: "#/settings"
    },
    {
      id: "notifications",
      title: "Notifications",
      blurb: "On the phone, the app keeps its own background connection, with its setup checklist and the ongoing notification explained. On Windows, the app posts its own tray notifications. The sample alert opens Junior's chat.",
      phone: "#/notifications",
      desk: "#/notifications"
    },
    {
      id: "bot-new",
      title: "New bot",
      blurb: "Name, description, purpose, default model, and folder. The purpose becomes BOT_PROFILE.md. The folder defaults to ~/.botsman/workspaces/&lt;id&gt;, the form shows free space on the server, and unsafe paths are refused. The new bot starts with Manual permissions and opens on its own chat.",
      phone: "#/bot/new",
      desk: "#/bot/new"
    },
    {
      id: "memory",
      title: "Memory",
      blurb: "Four files with their limits. USER_PROFILE.md and USER_MEMORY.md are shared by every bot, and BOT_PROFILE.md and BOT_MEMORY.md belong to one bot. You write the PROFILE files, and bots write the MEMORY files. A pending edit from the bot appears at the top with the conversation it came from. Confirm or Reject. The same item is in Needs you and in that bot's chat. Open Nightwatch or Junior for a sample.",
      phone: "#/memory/nightwatch",
      desk: "#/memory/nightwatch"
    },
    {
      id: "notes",
      title: "Notes",
      blurb: "Longer records a bot keeps, such as the projects it tracks. Search filters by keyword as you type. Open a note to read or edit it. A bot's edits here do not ask you.",
      phone: "#/notes/nightwatch",
      desk: "#/notes/nightwatch"
    },
    {
      id: "note",
      title: "One note",
      blurb: "A note is a Markdown file. Edit the name or the text, save, or delete it.",
      phone: "#/notes/nightwatch/billing",
      desk: "#/notes/nightwatch/billing"
    },
    {
      id: "bot-settings",
      title: "Bot settings",
      blurb: "Permission mode, approval wait, network, connections, and skills. Each bot turns connections on or off for itself. Botsman and server skills have a toggle per bot, off by default. Skills a bot created are always on.",
      phone: "#/bot-settings/nightwatch",
      desk: "#/bot-settings/nightwatch"
    },
    {
      id: "bot-settings-main",
      title: "Bot settings for the main bot",
      blurb: "The same screen, plus the server shell switch and adding connections. The server shell is off by default, and only you can turn it on. Only the main bot manages connections.",
      phone: "#/bot-settings/junior",
      desk: "#/bot-settings/junior"
    },
    {
      id: "bot-restore",
      title: "Restoring a deleted bot",
      blurb: "Deleted bots aren't listed anywhere in the apps. Ask the main bot, and it can restore one. It asks you first, and the bot returns to the list with its routines paused.",
      phone: "#/chat/junior?view=restore",
      desk: "#/chat/junior?view=restore"
    },
    {
      id: "convo",
      title: "One bot chat",
      blurb: "The line in a bot's chat with you opens this view. It is the only way in, and there is no separate list. Read-only until you tap Step in.",
      phone: "#/convo/junior-nightwatch",
      desk: "#/convo/junior-nightwatch"
    },
    {
      id: "convo-paused",
      title: "A paused bot chat",
      blurb: "An exchange pauses after 10 messages without you, and the line in the chat says Paused. Resume lets it continue. Stepping in also resumes it.",
      phone: "#/convo/atlas-scribe",
      desk: "#/convo/atlas-scribe"
    },
    {
      id: "providers",
      title: "Model providers",
      blurb: "Every provider is listed, connected or not, also reachable from the model picker. Connect opens the form under that row. Keys and sign-ins are stored on the server, encrypted, and cannot be viewed after saving.",
      phone: "#/providers",
      desk: "#/providers"
    },
    {
      id: "provider-signin",
      title: "Signing in to a provider",
      blurb: "OpenAI and OpenRouter offer an API key or a browser sign-in. The server can't receive the browser's redirect, so you paste the address or code back. GitHub Copilot shows a code instead. Anthropic's Claude subscription option finds an existing Claude Code login on the server, or shows the command to sign in, with a Usage label option.",
      phone: "#/providers?connect=OpenAI",
      desk: "#/providers?connect=OpenAI"
    },
    {
      id: "subagents",
      title: "Subagent work",
      blurb: "Nightwatch started a subagent. It shows as one line with the tool lines. Tap it for the task and the work so far.",
      phone: "#/chat/nightwatch",
      desk: "#/chat/nightwatch"
    },
    {
      id: "setup",
      title: "First-run setup",
      blurb: "Four steps: connect and set the owner password, add a model key, name the main bot and choose its server shell, and learn how alerts work. The last step differs between phone and desktop.",
      phone: "#/setup",
      desk: "#/setup"
    },
    {
      id: "login",
      title: "Login",
      blurb: "The session expired. The username is already filled in. Any non-empty password continues. This screen is the same one switching servers uses.",
      phone: "#/login",
      desk: "#/login"
    },
    {
      id: "update",
      title: "Update available",
      blurb: "Install, or Not now. Install is local to this mock: it only changes the version line.",
      phone: "#/update",
      desk: "#/update"
    }
  ];

  function applyTheme(t) {
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
    document.querySelectorAll("#theme button").forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.dataset.theme === (t || "system") ? "true" : "false");
    });
  }

  function fit() {
    document.querySelectorAll(".desk-scale").forEach(function (wrap) {
      const frame = wrap.querySelector(".desk-frame");
      if (!frame) return;
      const scale = Math.min(1, wrap.clientWidth / 1280);
      frame.style.transform = "scale(" + scale + ")";
      wrap.style.height = (800 * scale) + "px";
    });
  }

  const toc = document.getElementById("toc");
  const root = document.getElementById("screens");
  screens.forEach(function (s, i) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = "#" + s.id;
    a.textContent = (i + 1) + ". " + s.title;
    li.appendChild(a);
    toc.appendChild(li);

    const sec = document.createElement("section");
    sec.className = "screen";
    sec.id = s.id;
    const phoneSrc = "app.html?v=9&device=phone" + s.phone;
    const deskSrc = "app.html?v=9&device=desktop" + s.desk;
    sec.innerHTML =
      "<h2>" + s.title + "</h2>" +
      "<p class=\"blurb\">" + s.blurb + "</p>" +
      "<div class=\"stage\">" +
        "<div><div class=\"frame-label\"><span>Phone · 390</span><a href=\"" + phoneSrc + "\" target=\"_blank\" rel=\"noopener\">Open</a></div>" +
        "<div class=\"phone-frame\"><iframe title=\"" + s.title + " on a phone\" loading=\"" + (i < 2 ? "eager" : "lazy") + "\" src=\"" + phoneSrc + "\"></iframe></div></div>" +
        "<div class=\"desk-scale\"><div class=\"frame-label\"><span>Desktop · 1280</span><a href=\"" + deskSrc + "\" target=\"_blank\" rel=\"noopener\">Open</a></div>" +
        "<div class=\"desk-frame\"><iframe title=\"" + s.title + " on the desktop\" loading=\"" + (i < 2 ? "eager" : "lazy") + "\" src=\"" + deskSrc + "\"></iframe></div></div>" +
      "</div>";
    root.appendChild(sec);
  });

  document.getElementById("theme").addEventListener("click", function (e) {
    const btn = e.target.closest("button");
    if (!btn) return;
    const t = btn.dataset.theme;
    try { localStorage.setItem("hb-theme", t); } catch (err) { /* ignore */ }
    applyTheme(t);
  });
  window.addEventListener("storage", function (e) {
    if (e.key === "hb-theme") applyTheme(e.newValue || "system");
  });
  window.addEventListener("resize", fit);
  try { localStorage.removeItem("hb-flavor"); } catch (err) { /* ignore */ }
  document.documentElement.removeAttribute("data-flavor");
  applyTheme(localStorage.getItem("hb-theme") || "system");
  fit();
  window.addEventListener("load", fit);
})();

/* Builds the review page: every screen, phone and desktop. */
(function () {
  const screens = [
    {
      id: "shell",
      title: "Desktop shell and phone list",
      blurb: "On the desktop the bot list stays beside the open chat. Junior, the main profile, stays pinned at the top. The rest follow recent activity. Each row has a face, a short description, the model, a preview, and any unread, working, or needs-you mark. Needs you sits above the bots. Rooms are their own section. On the phone the list is the home screen: tap a bot to open the chat, and Back returns.",
      phone: "#/bots",
      desk: "#/chat/junior"
    },
    {
      id: "chat",
      title: "Bot chat",
      blurb: "Junior's chat. A routine posted the morning briefing, and the reply under it quotes that message. Older runs of that routine are earlier in the same chat. A private handoff is a full-width note: one line for who sent it, who it is for, and the time. Open it and the note wraps. Scroll for the table, the todo list, the file diff, and a code block with Copy. Finished replies show tokens, cost, and Retry. Thinking and tool lines are collapsed; tap one to open it. Summarize is in the header.",
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
      blurb: "Type / in the message box, or tap the / button. The menu filters as you type and moves with the arrow keys. Enter runs the highlighted command. These are Hermes commands without their own control: compress, clear, undo, skills, personality, usage, and help. Model, Stop, and routines stay as buttons. Summarize in the header does the same thing as /compress.",
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
      blurb: "Allow once, Allow for this chat, or Deny. The short line is the description; Full command shows the exact command. The timer is the five-minute auto-deny. The same item is in Needs you. Answering clears it in both places.",
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
      blurb: "A template fills the form. The schedule is a picker: daily, weekdays, weekly, or once. Advanced: cron reveals the expression that will be saved. Delivery is this bot's chat, an alert, or both. The alert comes from the app's background connection (or ntfy) on the phone and is a tray notification on Windows.",
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
      title: "Group room",
      blurb: "Standup is one shared channel. A bot talking to another bot is a normal message, with an @mention. A private handoff that never entered a room is not here; it shows up in each bot's own chat. House is the other room.",
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
      title: "Bot info and avatar",
      blurb: "Upload a photo or choose a mark. The face updates on the list, in the chat, and in rooms. Name and description are shown, not edited here.",
      phone: "#/bot/junior",
      desk: "#/bot/junior"
    },
    {
      id: "settings",
      title: "Servers",
      blurb: "Saved Hermes servers. Add one, or use another. Switching opens the sign-in screen with the username already filled in. Mode is System, Light, or Dark.",
      phone: "#/settings",
      desk: "#/settings"
    },
    {
      id: "notifications",
      title: "Notifications",
      blurb: "On the phone, the default is the app's own background connection over Tailscale, with its setup checklist. ntfy is the optional alternative: server, topic, and access token. On Windows, the app posts its own tray notifications. The sample alert opens Junior's chat.",
      phone: "#/notifications",
      desk: "#/notifications"
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
    const phoneSrc = "app.html?device=phone" + s.phone;
    const deskSrc = "app.html?device=desktop" + s.desk;
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

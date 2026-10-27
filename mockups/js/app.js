/* Clickable mock. All state lives in this page. No network. */
(function () {
  const DAY = ["S", "M", "T", "W", "T", "F", "S"];
  const DAYNAME = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const IC = {
    back: '<path d="M15 6 L9 12 L15 18"/>',
    up: '<path d="M12 18 V7 M7 11 L12 6 L17 11"/>',
    square: '<rect x="8" y="8" width="8" height="8" fill="currentColor" stroke="none"/>',
    clip: '<path d="M15.5 7.5 9 14a3 3 0 0 0 4.2 4.2l6.3-6.3a4.5 4.5 0 0 0-6.4-6.4L6.4 12.2"/>',
    image: '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.3" fill="currentColor" stroke="none"/><path d="M4 16 l5-4 3 2.5 3-2.5 5 4"/>',
    min: '<path d="M6 12h12"/>',
    max: '<rect x="6" y="6" width="12" height="12"/>',
    close: '<path d="M7 7 L17 17 M17 7 L7 17"/>',
    wifi: '<path d="M4.5 10.5a10 10 0 0 1 15 0"/><path d="M7.5 13.5a6 6 0 0 1 9 0"/><path d="M12 17h.01"/>',
    bat: '<rect x="2.5" y="8" width="16" height="8" rx="1.6"/><path d="M20.5 11v2"/>',
    check: '<path d="M5 12.5 9.5 17 19 7.5"/>',
    people: '<circle cx="9" cy="9" r="2.2"/><circle cx="16" cy="9.5" r="1.8"/><path d="M4.5 18c.6-2.4 2.4-3.5 4.5-3.5S13 15.6 13.6 18M13 18c.3-1.8 1.5-2.8 3-2.8 1.4 0 2.5.8 3.2 2.4"/>'
  };
  const MARK = {
    junior: '<circle cx="12" cy="12" r="4"/>',
    atlas: '<path d="M4.5 18.5 12 5.5 19.5 18.5 Z"/>',
    ledger: '<path d="M6 8h12M6 12h12M6 16h8"/>',
    quartermaster: '<rect x="6" y="6" width="12" height="12"/>',
    scribe: '<path d="M8 17 12 5.5 16 17M9.6 13h4.8"/>',
    nightwatch: '<path d="M14.5 6.2a6.2 6.2 0 1 0 .2 11.6 4.6 4.6 0 1 1-.2-11.6z"/>',
    diamond: '<path d="M12 4.5 19.5 12 12 19.5 4.5 12 Z"/>',
    waves: '<path d="M4 9c1.6 0 1.6 2.4 3.2 2.4S8.8 9 10.4 9 12 11.4 13.6 11.4 15.2 9 16.8 9 18.4 11.4 20 11.4M4 14.2c1.6 0 1.6 2.4 3.2 2.4S8.8 14.2 10.4 14.2s1.6 2.4 3.2 2.4 1.6-2.4 3.2-2.4 1.6 2.4 3.2 2.4"/>'
  };

  const bots = HB.bots.map(function (b) { return Object.assign({}, b, { queue: (b.queue || []).slice() }); });
  const rooms = HB.rooms.map(function (r) { return Object.assign({}, r); });
  const sessions = {};
  Object.keys(HB.sessions).forEach(function (k) {
    sessions[k] = HB.sessions[k].map(function (s) { return Object.assign({}, s); });
  });
  bots.forEach(function (b) {
    if (!sessions[b.id]) {
      sessions[b.id] = [{ id: "main", title: "Main", main: true, pinned: true, auto: false, when: "Today", preview: b.preview, sort: 1 }];
    }
  });
  const routines = HB.routines.map(function (r) {
    return Object.assign({}, r, { days: (r.days || []).slice(), runs: r.runs.map(function (x) { return Object.assign({}, x); }) });
  });
  const threads = {};
  Object.keys(HB.threads).forEach(function (k) {
    threads[k] = JSON.parse(JSON.stringify(HB.threads[k]));
  });
  const roomLogs = {};
  Object.keys(HB.roomsLog).forEach(function (k) {
    roomLogs[k] = HB.roomsLog[k].map(function (m) { return Object.assign({}, m); });
  });

  const state = {
    faces: {},
    session: {},
    overrides: {},
    modelScope: "chat",
    modelOpen: false,
    composer: "",
    attachments: [],
    replyTo: null,
    slashIndex: 0,
    steer: "",
    openThink: {},
    openTool: {},
    approvalOpen: false,
    approvalChoice: null,
    approvalLeft: 4 * 60 + 47,
    clarify: {},
    clarifySent: false,
    histQ: "",
    showArchived: false,
    rowMenu: null,
    renaming: null,
    renameValue: "",
    confirmDelete: null,
    form: null,
    toast: null,
    view: "",
    reconnect: null,
    menu: false,
    ntfyUrl: "http://100.101.102.10:8091",
    ntfyTopic: "hermes",
    notif: {},
    loginUser: HB.user,
    loginPass: "",
    loginError: "",
    pendingServer: null,
    addServer: { name: "", host: "", port: "9119", error: "" },
    installed: false,
    retrying: null,
    retried: {},
    focusId: null,
    focusAt: null,
    minute: 7 * 60 + 41,
    serverId: "devbox",
    servers: HB.servers.map(function (s) { return Object.assign({}, s); })
  };
  HB.notifications.forEach(function (n) { state.notif[n.id] = true; });
  bots.forEach(function (b) { state.session[b.id] = "main"; });

  let route = { parts: [], q: new URLSearchParams() };
  let ready = false;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function uid() { return "id" + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36); }
  function device() { return document.documentElement.getAttribute("data-device") === "phone" ? "phone" : "desktop"; }
  function svg(inner, size) {
    const s = size || 20;
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + "</svg>";
  }
  function money(n) { return "$" + (Math.round(n * 100) / 100).toFixed(2); }
  function toks(n) { return n.toLocaleString("en-US") + " tokens"; }
  function clock(sec) {
    const s = Math.max(0, sec | 0);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }
  function nowTime() {
    const h = Math.floor(state.minute / 60) % 24;
    const m = state.minute % 60;
    return h + ":" + String(m).padStart(2, "0");
  }
  function botBy(id) { return bots.filter(function (b) { return b.id === id; })[0] || null; }
  function botName(id) { const b = botBy(id); return b ? b.name : "Bot"; }
  function orderedBots() {
    return bots.filter(function (b) { return b.pinned; }).concat(
      bots.filter(function (b) { return !b.pinned; }).sort(function (a, b) { return b.activity - a.activity; })
    );
  }
  function currentServer() {
    return state.servers.filter(function (s) { return s.id === state.serverId; })[0] || state.servers[0];
  }
  function version() { return state.installed ? HB.nextVersion : HB.version; }
  function chatKey(botId) { return botId + ":" + (state.session[botId] || "main"); }
  function effective(bot) {
    const o = state.overrides[chatKey(bot.id)] || {};
    return {
      model: o.model || bot.model,
      effort: o.effort || bot.effort,
      custom: !!(o.model || o.effort)
    };
  }
  function sessionOf(botId) {
    const sid = state.session[botId] || "main";
    const list = sessions[botId] || [];
    return list.filter(function (s) { return s.id === sid; })[0] || list[0];
  }
  function currentThread(botId) {
    if (state.view === "attach" && botId === "junior" && threads["junior:attach"]) return threads["junior:attach"];
    const key = chatKey(botId);
    if (!threads[key]) threads[key] = [];
    return threads[key];
  }
  function findMessage(id) {
    const pools = Object.keys(threads).map(function (k) { return threads[k]; }).concat(Object.keys(roomLogs).map(function (k) { return roomLogs[k]; }));
    for (let i = 0; i < pools.length; i++) {
      const hit = pools[i].filter(function (m) { return m.id === id; })[0];
      if (hit) return hit;
    }
    return null;
  }
  function paras(text) {
    if (!text) return "";
    return '<div class="msg-body">' + esc(text).split(/\n\n+/).map(function (p) {
      return "<p>" + p.replace(/\n/g, "<br>") + "</p>";
    }).join("") + "</div>";
  }
  function snippet(text) {
    const line = String(text || "").split("\n").filter(Boolean)[0] || "";
    return line.length > 88 ? line.slice(0, 88) + "…" : line;
  }
  function prettyTime(hm) {
    if (!hm || hm.indexOf(":") < 0) return hm || "";
    const bits = hm.split(":");
    const h = parseInt(bits[0], 10) || 0;
    const m = bits[1];
    const ap = h >= 12 ? "PM" : "AM";
    return (h % 12 || 12) + ":" + m + " " + ap;
  }
  function dayList(days) {
    return (days || []).slice().sort(function (a, b) { return a - b; }).map(function (d) { return DAYNAME[d]; }).join(", ");
  }
  function toCron(f) {
    const bits = String(f.time || "00:00").split(":");
    const hour = String(parseInt(bits[0], 10) || 0);
    const min = String(parseInt(bits[1], 10) || 0);
    if (f.freq === "daily") return min + " " + hour + " * * *";
    if (f.freq === "weekdays") return min + " " + hour + " * * 1-5";
    if (f.freq === "weekly") {
      const d = (f.days || []).slice().sort(function (a, b) { return a - b; }).join(",");
      return min + " " + hour + " * * " + (d || "*");
    }
    if (f.freq === "once" && f.onceDate) {
      const p = f.onceDate.split("-");
      return min + " " + hour + " " + String(parseInt(p[2], 10) || 1) + " " + String(parseInt(p[1], 10) || 1) + " *";
    }
    return f.cron || (min + " " + hour + " * * *");
  }
  function schedLabel(job) {
    if (job.freq === "cron" || job.cronDirty) return "Cron · " + (job.cron || toCron(job));
    const t = prettyTime(job.time);
    if (job.freq === "daily") return "Daily · " + t;
    if (job.freq === "weekdays") return "Weekdays · " + t;
    if (job.freq === "once") return "Once · " + (job.onceDate || "") + " · " + t;
    if (job.freq === "weekly") return "Weekly · " + (dayList(job.days) || "pick days") + " · " + t;
    return job.cron || "";
  }
  function deliverLabel(job) {
    if (job.chat && job.ntfy) return "This bot's chat · ntfy";
    if (job.chat) return "This bot's chat";
    if (job.ntfy) return "ntfy only";
    return "Nowhere yet";
  }
  function showNeeds(b) {
    if (b.needs === "approval" && !state.approvalChoice) return true;
    if (b.needs === "question" && !state.clarifySent) return true;
    return false;
  }
  function needsItems() {
    const out = [];
    orderedBots().forEach(function (b) {
      if (b.needs === "approval" && !state.approvalChoice) out.push({ bot: b, kind: "approval" });
      if (b.needs === "question" && !state.clarifySent) out.push({ bot: b, kind: "question" });
    });
    return out;
  }
  function chatCost(list) {
    return list.reduce(function (s, m) { return s + ((m.usage && m.usage.cost) || 0); }, 0);
  }
  function prettySize(n) {
    if (!n && n !== 0) return "";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return Math.round(n / 1024) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
  }
  function homeHash() { return device() === "phone" ? "#/bots" : "#/chat/junior"; }
  function activeBot() {
    if (route.parts[0] === "chat") return botBy(route.parts[1]);
    return null;
  }
  function activeRoom() {
    if (route.parts[0] === "room") return rooms.filter(function (r) { return r.id === route.parts[1]; })[0] || null;
    return null;
  }

  function applyTheme(t) {
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
  }
  function parse() {
    const raw = (location.hash || "#").replace(/^#/, "");
    const cut = raw.split("?");
    return { parts: cut[0].split("/").filter(Boolean), q: new URLSearchParams(cut[1] || ""), raw: raw };
  }
  function blankForm(bot) {
    return {
      mode: "new", id: null, bot: bot || "junior", name: "", prompt: "", freq: "weekdays",
      time: "07:00", onceDate: "2026-10-27", days: [1, 2, 3, 4, 5], cron: "0 7 * * 1-5",
      cronDirty: false, cronOn: false, chat: true, ntfy: true, error: ""
    };
  }
  function formFrom(id) {
    const j = routines.filter(function (r) { return r.id === id; })[0];
    if (!j) return blankForm("junior");
    return {
      mode: "edit", id: j.id, bot: j.bot, name: j.name, prompt: j.prompt, freq: j.freq,
      time: j.time, onceDate: j.onceDate || "2026-10-27", days: (j.days || []).slice(),
      cron: j.cron || toCron(j), cronDirty: !!j.cronDirty, cronOn: !!j.cronDirty || j.freq === "cron",
      chat: !!j.chat, ntfy: !!j.ntfy, error: ""
    };
  }
  function onRoute() {
    const view = route.q.get("view") || "";
    state.view = view;
    state.modelOpen = view === "model";
    state.menu = false;
    state.rowMenu = null;
    state.reconnect = view === "reconnect" ? "down" : null;
    state.slashIndex = 0;
    if (view === "slash") {
      state.composer = "/";
      state.focusId = "composer";
    } else state.composer = "";
    if (view === "attach") {
      state.attachments = [
        { id: "seed-img", kind: "image", name: "Pasted image", src: HB.photo },
        { id: "seed-pdf", kind: "file", name: "invoice.pdf", size: "84 KB" }
      ];
      if (!threads["junior:attach"]) threads["junior:attach"] = JSON.parse(JSON.stringify(HB.attachThread));
    } else state.attachments = [];
    state.replyTo = null;
    const a = route.parts[0], b = route.parts[1], c = route.parts[2];
    if (a === "routine" && b === "new") state.form = blankForm(route.q.get("bot") || "junior");
    else if (a === "routine" && b === "edit") state.form = formFrom(c);
    if (a === "chat" && b) {
      const seen = botBy(b);
      if (seen) seen.unread = 0;
    }
    if (a === "login") {
      state.focusId = "password";
      state.loginError = "";
      state.pendingServer = route.q.get("reason") === "switch" ? route.q.get("server") : null;
    }
  }

  function backTarget() {
    const a = route.parts[0], b = route.parts[1], c = route.parts[2];
    const phone = device() === "phone";
    const home = homeHash();
    if (!a || a === "bots" || a === "login" || a === "update") return null;
    if (a === "chat" || a === "room") return phone ? "#/bots" : null;
    if (a === "history" || a === "bot") return "#/chat/" + b;
    if (a === "routines" && b) return "#/chat/" + b;
    if (a === "routines") return home;
    if (a === "routine" && b === "new") {
      const bot = (state.form && state.form.bot) || route.q.get("bot");
      return bot ? "#/routines/" + bot : "#/routines";
    }
    if (a === "routine" && (b === "edit" || b === "runs")) {
      const job = routines.filter(function (r) { return r.id === c; })[0];
      return job ? "#/routines/" + job.bot : "#/routines";
    }
    if (a === "usage" || a === "settings") return home;
    if (a === "notifications") return "#/settings";
    return home;
  }
  function footOn(name) {
    const a = route.parts[0];
    if (name === "routines") return a === "routines" && !route.parts[1];
    if (name === "usage") return a === "usage";
    if (name === "settings") return a === "settings" || a === "notifications";
    return false;
  }

  function avatar(botId, opt) {
    opt = opt || {};
    const bot = botBy(botId);
    const face = state.faces[botId] || { type: "mark", id: bot ? bot.mark : "junior" };
    const cls = "av" + (opt.sm ? " sm" : "") + (opt.lg ? " lg" : "") + (opt.sq ? " sq" : "");
    const size = opt.lg ? 44 : opt.sm ? 16 : 20;
    if (face.type === "img") return '<span class="' + cls + '"><img alt="" src="' + face.src + '"></span>';
    return '<span class="' + cls + '">' + svg(MARK[face.id] || MARK.junior, size) + "</span>";
  }
  function roomAvatar() {
    return '<span class="av sq">' + svg(IC.people, 20) + "</span>";
  }

  function botRow(b) {
    const on = (route.parts[0] === "chat" && route.parts[1] === b.id) || (route.parts[0] === "history" && route.parts[1] === b.id) || (route.parts[0] === "bot" && route.parts[1] === b.id);
    return '<button type="button" class="bot-row' + (on ? " on" : "") + '" data-act="open-bot" data-id="' + b.id + '">' +
      avatar(b.id) +
      '<span class="bot-mid"><span class="bot-line"><span class="bot-name">' + esc(b.name) + "</span>" +
      (b.pinned ? '<span class="tag">Main</span>' : "") + "</span>" +
      '<span class="bot-sub">' + esc(b.description) + "</span>" +
      '<span class="bot-sub2"><span class="model">' + esc(b.model) + "</span>" +
      (b.preview ? '<span class="bot-preview"> · ' + esc(b.preview) + "</span>" : "") +
      "</span></span>" +
      '<span class="bot-right"><span class="bot-time">' + esc(b.time) + "</span>" +
      (b.unread ? '<span class="pill">' + b.unread + "</span>" : "") +
      (b.working ? '<span class="flag"><i class="work-dot pulse"></i>Working</span>' : "") +
      (showNeeds(b) ? '<span class="flag">Needs you</span>' : "") +
      "</span></button>";
  }
  function roomRow(r) {
    const on = route.parts[0] === "room" && route.parts[1] === r.id;
    const names = r.members.map(botName).join(", ");
    return '<button type="button" class="room-row' + (on ? " on" : "") + '" data-act="nav" data-to="#/room/' + r.id + '">' +
      roomAvatar() +
      '<span class="bot-mid"><span class="bot-name">' + esc(r.name) + '</span><span class="bot-sub">' + esc(names) + '</span><span class="bot-preview">' + esc(r.preview) + "</span></span><span></span></button>";
  }
  function needRow(item) {
    const b = item.bot;
    const label = item.kind === "approval" ? "Approval" : "Question";
    const sub = item.kind === "approval" ? HB.approval.title : HB.questions[0].prompt;
    const timer = item.kind === "approval" ? '<span class="bot-time" id="need-timer">' + clock(state.approvalLeft) + "</span>" : "";
    return '<button type="button" class="need-row" data-act="open-bot" data-id="' + b.id + '"><i class="work-dot"></i><span class="need-mid"><span class="need-k">' + esc(b.name) + " · " + label + '</span><span class="need-sub">' + esc(sub) + "</span></span>" + timer + "</button>";
  }
  function sidebar() {
    const needs = needsItems();
    return '<aside class="sidebar"><div class="side-top"><div class="wordmark">Hermes Bots</div></div>' +
      (needs.length ? '<div style="padding:0 8px"><div class="side-label">Needs you</div>' + needs.map(needRow).join("") + "</div>" : "") +
      '<div class="side-scroll"><div class="side-label">Bots</div>' + orderedBots().map(botRow).join("") +
      '<div class="side-label">Rooms</div>' + rooms.map(roomRow).join("") + "</div>" +
      '<div class="side-foot">' +
      '<button type="button" class="foot-btn' + (footOn("routines") ? " on" : "") + '" data-act="nav" data-to="#/routines">Routines</button>' +
      '<button type="button" class="foot-btn' + (footOn("usage") ? " on" : "") + '" data-act="nav" data-to="#/usage">Usage</button>' +
      '<button type="button" class="foot-btn' + (footOn("settings") ? " on" : "") + '" data-act="nav" data-to="#/settings">Settings</button>' +
      '<div class="conn">Connected to ' + esc(currentServer().name) + "</div></div></aside>";
  }
  function listPage() {
    const needs = needsItems();
    return '<div class="list-page pane"><div class="list-head"><div class="wordmark">Hermes Bots</div></div>' +
      '<div class="phone-links"><button type="button" data-act="nav" data-to="#/routines">Routines</button>' +
      '<button type="button" data-act="nav" data-to="#/usage">Usage</button>' +
      '<button type="button" data-act="nav" data-to="#/settings">Settings</button></div>' +
      (needs.length ? '<div class="list-block"><div class="side-label">Needs you</div>' + needs.map(needRow).join("") + "</div>" : "") +
      '<div class="list-block"><div class="side-label">Bots</div>' + orderedBots().map(botRow).join("") + "</div>" +
      '<div class="list-block"><div class="side-label">Rooms</div>' + rooms.map(roomRow).join("") + "</div></div>";
  }

  function backBtn() {
    const to = backTarget();
    if (!to) return "";
    return '<button type="button" class="text-btn back" data-act="nav" data-to="' + to + '">' + svg(IC.back, 18) + "Back</button>";
  }
  function column(title, sub, body, extra) {
    return '<div class="column"><div class="topbar">' + backBtn() +
      '<div class="topbar-text"><strong>' + esc(title) + "</strong><span>" + esc(sub || "") + "</span></div>" +
      (extra || "") + "</div>" + body + "</div>";
  }

  function thinkOpen(m) {
    if (Object.prototype.hasOwnProperty.call(state.openThink, m.id)) return state.openThink[m.id];
    return !!(m.thinking && m.thinking.open);
  }
  function toolOpen(id) { return !!state.openTool[id]; }

  function userMessage(m, list) {
    const quoted = m.replyTo && list.filter(function (x) { return x.id === m.replyTo; })[0];
    const quote = quoted ? '<div class="quote"><b>' + esc(quoted.routine || "Message") + "</b>" + esc(snippet(quoted.text)) + "</div>" : "";
    const img = m.image ? '<img class="shot" alt="' + esc(m.imageName || "Pasted image") + '" src="' + m.image + '">' : "";
    const file = m.file ? '<span class="filechip">' + esc(m.file.name) + (m.file.size ? ' <span class="tag">' + esc(m.file.size) + "</span>" : "") + "</span>" : "";
    return '<div class="msg msg-user"><div class="bubble">' + quote + paras(m.text) + img + file + '</div><div class="msg-time">' + esc(m.time || "") + "</div></div>";
  }
  function routineMessage(m) {
    return '<div class="msg msg-assistant">' + avatar(m.who, { sm: true }) + "<div>" +
      '<div class="kicker">Routine · ' + esc(m.routine) + "</div>" +
      '<div class="who">' + esc(botName(m.who)) + " <span>" + esc(m.time || "") + "</span></div>" +
      '<div class="routine-card">' + paras(m.text) + "</div>" +
      '<div class="usage-line"><button type="button" class="text-btn" data-act="reply" data-id="' + m.id + '">Reply</button>' +
      '<button type="button" class="text-btn" data-act="copy-msg" data-id="' + m.id + '">Copy</button></div></div></div>';
  }
  function roomBotMessage(m) {
    const between = m.to && m.to !== "you";
    const name = between ? botName(m.who) + " → " + botName(m.to) : botName(m.who);
    return '<div class="msg msg-assistant">' + avatar(m.who, { sm: true }) +
      '<div class="' + (between ? "b2b" : "") + '">' +
      (between ? '<div class="kicker">Between bots</div>' : "") +
      '<div class="who">' + esc(name) + " <span>" + esc(m.time || "") + "</span></div>" +
      paras(m.text) + "</div></div>";
  }
  function assistantMessage(m) {
    const open = !!(m.thinking && thinkOpen(m));
    let think = "";
    if (m.thinking) {
      const label = m.thinking.streaming ? "Thinking…" : "Thought for " + m.thinking.seconds + "s";
      think = '<button type="button" class="think" data-act="think" data-id="' + m.id + '">' + (open ? "▾" : "▸") + " " + label + "</button>";
      if (open) {
        const cls = m.thinking.streaming ? "think-body caret" : "think-body";
        think += '<div class="' + cls + '">' + esc(m.thinking.text) + "</div>";
      }
    }
    const tools = (m.tools || []).map(function (t) {
      const opened = toolOpen(t.id);
      let block = '<button type="button" class="tool" data-act="tool" data-id="' + t.id + '">' +
        (t.running ? '<i class="work-dot pulse"></i>' : "") + (opened ? "▾ " : "▸ ") + esc(t.line) + "</button>";
      if (opened) {
        block += '<div class="tool-body"><div class="kv">Input</div>' + esc(t.input || "") + '<div class="kv">Output</div>' + esc(t.output || "") + "</div>";
      }
      return block;
    }).join("");
    const todos = m.todos && m.todos.length ? '<div class="todos">' + m.todos.map(function (td) {
      return '<div class="todo' + (td.done ? " done" : "") + '"><span class="box' + (td.done ? " on" : "") + '">' + (td.done ? svg(IC.check, 12) : "") + "</span><span>" + esc(td.text) + "</span></div>";
    }).join("") + "</div>" : "";
    const body = m.html ? '<div class="msg-body">' + m.html + "</div>" : paras(m.text);
    const diff = m.diff ? '<div class="diff"><div class="diff-file">' + esc(m.diff.file) + "</div>" + m.diff.lines.map(function (ln) {
      const kind = ln.t === "add" ? "add" : ln.t === "del" ? "del" : "";
      const pre = ln.t === "add" ? "+ " : ln.t === "del" ? "− " : "  ";
      return '<div class="diff-line ' + kind + '">' + pre + esc(ln.s) + "</div>";
    }).join("") + "</div>" : "";
    const code = m.code ? '<div class="code"><div class="code-bar"><span>' + esc(m.code.lang) + '</span><button type="button" class="text-btn" data-act="copy-code" data-id="' + m.id + '">Copy</button></div><pre>' + esc(m.code.text) + "</pre></div>" : "";
    let usage = "";
    if (state.retrying === m.id) usage = '<div class="usage-line">Retrying…</div>';
    else if (m.usage) {
      usage = '<div class="usage-line"><span>' + toks(m.usage.tokens) + " · " + money(m.usage.cost) + "</span>" +
        '<button type="button" class="text-btn" data-act="retry" data-id="' + m.id + '">Retry</button>' +
        '<button type="button" class="text-btn" data-act="copy-msg" data-id="' + m.id + '">Copy</button>' +
        (state.retried[m.id] ? "<span>Retried</span>" : "") + "</div>";
    }
    return '<div class="msg msg-assistant">' + avatar(m.who, { sm: true }) + "<div>" +
      '<div class="who">' + esc(botName(m.who)) + " <span>" + esc(m.time || "") + "</span></div>" +
      think + tools + todos + body + diff + code + usage + "</div></div>";
  }
  function renderMessage(m, list) {
    if (m.role === "system") return '<div class="sys">' + esc(m.text) + "</div>";
    if (m.role === "user") return userMessage(m, list);
    if (m.role === "routine") return routineMessage(m);
    if (m.role === "bot") return roomBotMessage(m);
    return assistantMessage(m);
  }

  function approvalCard() {
    if (state.approvalChoice) {
      const map = { once: "Allowed once", chat: "Allowed for this chat", deny: "Denied", auto: "Denied automatically" };
      return '<div class="card"><div class="settled">' + map[state.approvalChoice] + " · " + esc(HB.approval.title) + "</div></div>";
    }
    return '<div class="card alert"><span class="timer" id="approval-timer">Auto-denies in ' + clock(state.approvalLeft) + '</span>' +
      '<div class="kicker">Needs you</div><h3>' + esc(HB.approval.title) + "</h3><p>" + esc(HB.approval.description) + "</p>" +
      '<button type="button" class="text-btn" data-act="approval-expand">' + (state.approvalOpen ? "Hide command" : "Full command") + "</button>" +
      (state.approvalOpen ? '<pre class="cmd">' + esc(HB.approval.command) + "</pre>" : "") +
      '<div class="choices"><button type="button" class="choice primary" data-act="approve" data-id="once">Allow once</button>' +
      '<button type="button" class="choice" data-act="approve" data-id="chat">Allow for this chat</button>' +
      '<button type="button" class="choice" data-act="approve" data-id="deny">Deny</button></div></div>';
  }
  function clarifyCard() {
    if (state.clarifySent) {
      const lines = HB.questions.map(function (q) {
        const a = state.clarify[q.id] || { opts: [], text: "" };
        const bits = a.opts.slice();
        if (a.text && a.text.trim()) bits.push(a.text.trim());
        return "<p><b>" + esc(q.prompt) + "</b><br>" + esc(bits.join(", ") || "No answer") + "</p>";
      }).join("");
      return '<div class="card"><div class="kicker">Sent</div><h3>Answers for Atlas</h3>' + lines + "</div>";
    }
    const body = HB.questions.map(function (q, i) {
      const a = state.clarify[q.id] || { opts: [], text: "" };
      return '<div class="q"><b>' + (i + 1) + ". " + esc(q.prompt) + '</b><div class="need-k">' + (q.multi ? "Choose any" : "Choose one") + "</div>" +
        '<div class="opts">' + q.options.map(function (o) {
          const on = a.opts.indexOf(o) >= 0;
          return '<button type="button" class="opt' + (on ? " on" : "") + '" data-act="opt" data-q="' + q.id + '" data-id="' + esc(o) + '" data-multi="' + (q.multi ? "1" : "") + '">' + esc(o) + "</button>";
        }).join("") + "</div>" +
        '<input data-field="clarify:' + q.id + '" placeholder="Or type your own" value="' + esc(a.text || "") + '"></div>';
    }).join("");
    return '<div class="card alert clarify"><div class="card-body"><div class="kicker">Needs you</div><h3>Five questions before the memo</h3><p>Atlas will wait for this.</p>' + body +
      '</div><div class="card-foot"><button type="button" class="primary block" data-act="clarify-send">Send answers</button></div></div>';
  }

  function filteredCommands() {
    const q = state.composer.replace(/^\//, "").trim().toLowerCase();
    return HB.commands.filter(function (c) {
      return !q || c.name.indexOf(q) >= 0 || c.hint.toLowerCase().indexOf(q) >= 0;
    });
  }
  function slashMenu() {
    const items = filteredCommands();
    if (!state.composer.startsWith("/")) return "";
    if (!items.length) return '<div class="slash"><button type="button" tabindex="-1">No matching commands</button></div>';
    if (state.slashIndex >= items.length) state.slashIndex = 0;
    return '<div class="slash">' + items.map(function (c, i) {
      return '<button type="button" class="' + (i === state.slashIndex ? "on" : "") + '" data-act="slash" data-id="' + c.name + '"><b>/' + c.name + '</b> <span>' + esc(c.hint) + "</span></button>";
    }).join("") + "</div>";
  }
  function modelPop(bot) {
    const eff = effective(bot);
    const scope = state.modelScope;
    const curModel = scope === "bot" ? bot.model : eff.model;
    const curEffort = scope === "bot" ? bot.effort : eff.effort;
    const note = scope === "chat"
      ? bot.name + "'s default is " + bot.model + " · " + bot.effort + ". This changes only the open chat."
      : "This changes " + bot.name + " everywhere a chat has not picked its own.";
    return '<div class="pop" id="model-pop"><div class="seg">' +
      '<button type="button" class="' + (scope === "chat" ? "on" : "") + '" data-act="scope" data-id="chat">This chat</button>' +
      '<button type="button" class="' + (scope === "bot" ? "on" : "") + '" data-act="scope" data-id="bot">Bot default</button></div>' +
      '<div class="scope-note">' + esc(note) + "</div><h4>Model</h4>" +
      HB.models.map(function (m) {
        return '<button type="button" class="row" data-act="pick-model" data-id="' + esc(m) + '">' + (m === curModel ? "● " : "○ ") + esc(m) + "</button>";
      }).join("") + "<h4>Reasoning effort</h4>" +
      HB.efforts.map(function (m) {
        return '<button type="button" class="row" data-act="pick-effort" data-id="' + esc(m) + '">' + (m === curEffort ? "● " : "○ ") + esc(m) + "</button>";
      }).join("") + "</div>";
  }
  function attachRow() {
    if (!state.attachments.length) return "";
    return '<div class="attach-row">' + state.attachments.map(function (a) {
      const thumb = a.kind === "image" ? '<img alt="" src="' + a.src + '">' : "";
      return '<span class="chip">' + thumb + esc(a.name) + (a.size ? " · " + esc(a.size) : "") +
        '<button type="button" data-act="unattach" data-id="' + a.id + '" aria-label="Remove">×</button></span>';
    }).join("") + "</div>";
  }
  function queueRow(bot) {
    if (!bot.queue || !bot.queue.length) return "";
    return '<div class="queue">' + bot.queue.map(function (q, i) {
      return '<span class="chip">Queued · ' + esc(q) + '<button type="button" data-act="unqueue" data-id="' + i + '" aria-label="Remove from queue">×</button></span>';
    }).join("") + "</div>";
  }
  function canSend() { return !!(state.composer.trim() || state.attachments.length); }
  function dock(bot, room) {
    const working = bot && bot.working;
    const reply = state.replyTo ? findMessage(state.replyTo) : null;
    const replyHtml = reply ? '<div class="replychip"><span class="chip">Replying to ' + esc(reply.routine || "message") +
      '<button type="button" data-act="clear-reply" aria-label="Cancel reply">×</button></span></div>' : "";
    const eff = bot ? effective(bot) : null;
    const placeholder = room ? "Message " + room.name : (working ? "Queue a message" : "Message " + bot.name);
    const sendBtn = working
      ? '<button type="button" class="text-btn" id="queue-btn" data-act="send"' + (canSend() ? "" : " hidden") + ">Queue</button>" +
        '<button type="button" class="ghost" data-act="stop">' + svg(IC.square, 12) + " Stop</button>"
      : '<button type="button" class="send" id="send-btn" data-act="send"' + (canSend() ? "" : " disabled") + ' aria-label="Send">' + svg(IC.up, 18) + "</button>";
    const modelBtn = eff ? '<button type="button" class="model-chip" data-act="toggle-model">' + esc(eff.model) + " · " + esc(eff.effort) + "</button>" : "";
    const steer = working ? '<div class="steer-row"><input id="steer" data-field="steer" placeholder="Steer · add a note to this turn" value="' + esc(state.steer) + '">' +
      '<button type="button" class="ghost" id="steer-btn" data-act="steer"' + (state.steer.trim() ? "" : " disabled") + ">Steer</button></div>" : "";
    return '<div class="dock"><div class="dock-inner">' + replyHtml + attachRow() + (bot ? queueRow(bot) : "") + steer +
      '<div id="slash-host">' + slashMenu() + "</div>" +
      (state.modelOpen && bot ? modelPop(bot) : "") +
      '<div class="composer-box"><textarea id="composer" rows="1" placeholder="' + esc(placeholder) + '" autocomplete="off">' + esc(state.composer) + "</textarea>" +
      '<div class="composer-tools"><button type="button" class="icon-btn" data-act="pick-file" aria-label="Attach file">' + svg(IC.clip) + "</button>" +
      '<button type="button" class="icon-btn" data-act="paste-sample" aria-label="Paste image">' + svg(IC.image) + "</button>" +
      '<button type="button" class="icon-btn" data-act="slash-ins" aria-label="Slash commands">/</button><span class="spacer"></span>' +
      modelBtn + sendBtn + "</div></div>" +
      '<input id="file-in" type="file" multiple hidden accept="image/*,.pdf,.txt,.md,.json,.csv"></div></div>';
  }
  function bannerHtml() {
    if (state.reconnect === "down") {
      return '<div class="banner" role="status"><i class="pulse"></i><span><strong>Reconnecting</strong><span class="sub">devbox · the thread catches up when the link is back</span></span><button type="button" class="text-btn" data-act="reconnect">Retry</button></div>';
    }
    if (state.reconnect === "ok") return '<div class="banner" role="status"><strong>Caught up</strong></div>';
    return "";
  }
  function chatActions(bot) {
    if (device() === "phone") {
      return '<button type="button" class="text-btn" data-act="menu">More</button>' +
        (state.menu ? '<div class="sheet"><button type="button" data-act="nav" data-to="#/history/' + bot.id + '">Chats</button>' +
          '<button type="button" data-act="nav" data-to="#/bot/' + bot.id + '">Bot info</button>' +
          '<button type="button" data-act="nav" data-to="#/routines/' + bot.id + '">Routines</button>' +
          '<button type="button" data-act="nav" data-to="#/usage">Usage</button>' +
          '<button type="button" data-act="nav" data-to="#/settings">Settings</button></div>' : "");
    }
    return '<div class="topbar-actions"><button type="button" class="text-btn" data-act="nav" data-to="#/history/' + bot.id + '">Chats</button>' +
      '<button type="button" class="text-btn" data-act="nav" data-to="#/bot/' + bot.id + '">Info</button></div>';
  }
  function chatColumn(botId) {
    const bot = botBy(botId) || bots[0];
    const list = currentThread(bot.id);
    const sess = sessionOf(bot.id);
    const eff = effective(bot);
    const bits = [];
    if (state.view === "attach") bits.push("Attachments");
    else bits.push(sess && sess.main ? "Main chat" : (sess ? sess.title : "Chat"));
    bits.push(eff.model, eff.effort);
    if (eff.custom) bits.push("this chat");
    const cost = chatCost(list);
    if (cost) bits.push(money(cost) + " this chat");
    if (bot.working) bits.push("Working…");
    let cards = "";
    if (bot.id === "ledger") cards += approvalCard();
    if (bot.id === "atlas") cards += clarifyCard();
    const empty = !list.length ? '<div class="empty">This side chat is empty.<br>Routines stay in the main chat.</div>' : "";
    return '<div class="column"><div class="topbar">' + backBtn() + avatar(bot.id) +
      '<div class="topbar-text"><strong>' + esc(bot.name) + "</strong><span>" + esc(bits.join(" · ")) + "</span></div>" +
      chatActions(bot) + "</div>" + bannerHtml() +
      '<div class="pane"><div class="thread">' + empty + list.map(function (m) { return renderMessage(m, list); }).join("") +
      (cards ? '<div class="msg">' + cards + "</div>" : "") + "</div></div>" + dock(bot, null) + "</div>";
  }
  function roomColumn(roomId) {
    const room = rooms.filter(function (r) { return r.id === roomId; })[0];
    if (!room) return column("Room", "", '<div class="pane"><div class="empty">That room is gone.</div></div>');
    const names = room.members.map(botName).join(", ");
    const list = roomLogs[room.id] || [];
    return '<div class="column"><div class="topbar">' + backBtn() + roomAvatar() +
      '<div class="topbar-text"><strong>' + esc(room.name) + "</strong><span>" + esc(names) + "</span></div></div>" +
      '<div class="pane"><div class="thread">' + list.map(function (m) { return renderMessage(m, list); }).join("") + "</div></div>" +
      dock(null, room) + "</div>";
  }

  function histRow(botId, s) {
    const title = state.renaming === s.id
      ? '<input id="rename" class="rename" value="' + esc(state.renameValue) + '" aria-label="Chat name">'
      : '<button type="button" class="title" data-act="open-session" data-bot="' + botId + '" data-id="' + s.id + '"><span class="t">' + esc(s.title) + "</span>" +
        (s.main ? ' <span class="tag">Main chat</span>' : "") +
        (s.auto ? ' <span class="tag">Auto title</span>' : "") +
        '<span class="m">' + esc(s.when) + " · " + esc(s.preview || "") + "</span></button>";
    let menu;
    if (state.confirmDelete === s.id) {
      menu = '<div class="confirm">Delete?<button type="button" class="text-btn" data-act="delete-yes" data-bot="' + botId + '" data-id="' + s.id + '">Delete</button><button type="button" class="text-btn" data-act="delete-no">Cancel</button></div>';
    } else {
      const open = state.rowMenu === s.id;
      menu = '<button type="button" class="text-btn" data-act="row-menu" data-id="' + s.id + '" aria-label="Chat actions">···</button>' +
        (open ? '<div class="pop-menu">' +
          (s.main ? "" : '<button type="button" data-act="pin" data-bot="' + botId + '" data-id="' + s.id + '">' + (s.pinned ? "Unpin" : "Pin") + "</button>") +
          '<button type="button" data-act="rename" data-bot="' + botId + '" data-id="' + s.id + '">Rename</button>' +
          (s.main ? "" : '<button type="button" data-act="archive" data-bot="' + botId + '" data-id="' + s.id + '">' + (s.archived ? "Unarchive" : "Archive") + "</button>") +
          (s.main ? "" : '<button type="button" data-act="delete-ask" data-id="' + s.id + '">Delete</button>') +
          "</div>" : "");
    }
    return '<div class="hist-row">' + title + '<div class="menu">' + menu + "</div></div>";
  }
  function historyView(botId) {
    const bot = botBy(botId) || bots[0];
    const q = state.histQ.trim().toLowerCase();
    let list = (sessions[bot.id] || []).slice();
    if (q) list = list.filter(function (s) { return (s.title + " " + (s.preview || "")).toLowerCase().indexOf(q) >= 0; });
    const pinned = list.filter(function (s) { return s.pinned && !s.archived; }).sort(function (a, b) {
      if (a.main !== b.main) return a.main ? -1 : 1;
      return b.sort - a.sort;
    });
    const rest = list.filter(function (s) { return !s.pinned && !s.archived; });
    const archAll = (sessions[bot.id] || []).filter(function (s) { return s.archived; });
    const arch = list.filter(function (s) { return s.archived && (q || state.showArchived); });
    function byWhen(arr) {
      const order = ["Today", "Yesterday", "Last week"];
      const groups = [];
      order.forEach(function (w) {
        const items = arr.filter(function (s) { return s.when === w; }).sort(function (a, b) { return b.sort - a.sort; });
        if (items.length) groups.push([w, items]);
      });
      const other = arr.filter(function (s) { return order.indexOf(s.when) < 0; });
      if (other.length) groups.push(["Earlier", other]);
      return groups;
    }
    let html = "";
    if (pinned.length) html += '<div class="group-label">Pinned</div>' + pinned.map(function (s) { return histRow(bot.id, s); }).join("");
    byWhen(rest).forEach(function (g) {
      html += '<div class="group-label">' + g[0] + "</div>" + g[1].map(function (s) { return histRow(bot.id, s); }).join("");
    });
    if (arch.length) html += '<div class="group-label">Archived</div>' + arch.map(function (s) { return histRow(bot.id, s); }).join("");
    if (!html) html = '<div class="empty">No chats match.</div>';
    const archBtn = archAll.length && !q
      ? '<button type="button" class="text-btn" data-act="toggle-arch">' + (state.showArchived ? "Hide archived" : "Show archived (" + archAll.length + ")") + "</button>"
      : "";
    const body = '<div class="pane"><div class="page"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><h2>Chats</h2>' +
      '<button type="button" class="primary" data-act="new-side" data-id="' + bot.id + '">New side chat</button></div>' +
      '<p class="lede">Search, pin, rename, archive, or delete. Auto titles stick until you rename them. Routines stay in Main.</p>' +
      '<input id="hist-q" class="search" placeholder="Search this bot" value="' + esc(state.histQ) + '">' +
      html + '<div style="margin-top:12px">' + archBtn + "</div></div></div>";
    return column(bot.name, "Side chats and history", body);
  }

  function routineCard(job) {
    return '<div class="r-card"><div class="bot-line"><h3>' + esc(job.name) + "</h3>" +
      (job.paused ? '<span class="paused-tag">Paused</span>' : "") + "</div>" +
      '<div class="meta">' + esc(schedLabel(job)) + "<br>" + esc(deliverLabel(job)) + "</div>" +
      '<div class="r-actions">' +
      '<button type="button" class="ghost" data-act="pause" data-id="' + job.id + '">' + (job.paused ? "Resume" : "Pause") + "</button>" +
      '<button type="button" class="ghost" data-act="run-now" data-id="' + job.id + '">Run now</button>' +
      '<button type="button" class="ghost" data-act="nav" data-to="#/routine/edit/' + job.id + '">Edit</button>' +
      '<button type="button" class="ghost" data-act="nav" data-to="#/routine/runs/' + job.id + '">History</button></div></div>';
  }
  function routinesView(botId) {
    const toast = state.toast ? '<div class="toast" id="toast">' + esc(state.toast.text) + ' <button type="button" class="text-btn" data-act="nav" data-to="' + state.toast.to + '">Open chat</button></div>' : "";
    let body;
    if (botId) {
      const mine = routines.filter(function (r) { return r.bot === botId; });
      body = '<div class="pane"><div class="page">' + toast +
        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><h2>' + esc(botName(botId)) + '</h2>' +
        '<button type="button" class="primary" data-act="nav" data-to="#/routine/new?bot=' + botId + '">New routine</button></div>' +
        '<p class="lede">Results post into this bot\'s main chat.</p>' +
        (mine.length ? mine.map(routineCard).join("") : '<div class="empty">No routines yet.</div>') +
        "</div></div>";
      return column("Routines", botName(botId), body);
    }
    const groups = orderedBots().map(function (b) {
      return [b, routines.filter(function (r) { return r.bot === b.id; })];
    }).filter(function (g) { return g[1].length; });
    body = '<div class="pane"><div class="page">' + toast +
      '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><h2>All routines</h2>' +
      '<button type="button" class="primary" data-act="nav" data-to="#/routine/new?bot=junior">New routine</button></div>' +
      '<p class="lede">Every bot. A run posts into that bot\'s main chat, and can also ping ntfy.</p>' +
      groups.map(function (g) {
        return '<div class="group-label">' + esc(g[0].name) + "</div>" + g[1].map(routineCard).join("");
      }).join("") + "</div></div>";
    return column("Routines", "All bots", body);
  }
  function formView() {
    const f = state.form || blankForm("junior");
    const segs = [["daily", "Daily"], ["weekdays", "Weekdays"], ["weekly", "Weekly"], ["once", "Once"]].map(function (p) {
      return '<button type="button" class="' + (f.freq === p[0] ? "on" : "") + '" data-act="freq" data-id="' + p[0] + '">' + p[1] + "</button>";
    }).join("");
    const days = f.freq === "weekly" || f.freq === "weekdays"
      ? '<div class="field"><div class="lbl">Days</div><div class="days">' + DAY.map(function (ch, i) {
        const on = (f.days || []).indexOf(i) >= 0;
        return '<button type="button" class="day' + (on ? " on" : "") + '" data-act="day" data-id="' + i + '" aria-label="' + DAYNAME[i] + '">' + ch + "</button>";
      }).join("") + "</div></div>" : "";
    const once = f.freq === "once" ? '<div class="field"><label for="once-date">Date</label><input id="once-date" type="date" data-field="form:onceDate" value="' + esc(f.onceDate || "") + '"></div>' : "";
    const botsel = f.mode === "new"
      ? '<div class="field"><label for="form-bot">Bot</label><select id="form-bot">' + bots.map(function (b) {
        return '<option value="' + b.id + '"' + (b.id === f.bot ? " selected" : "") + ">" + esc(b.name) + "</option>";
      }).join("") + "</select></div>" : '<div class="field"><div class="lbl">Bot</div><div>' + esc(botName(f.bot)) + "</div></div>";
    const templates = '<div class="lbl">Templates</div><div class="templates">' + HB.templates.map(function (t) {
      return '<button type="button" class="ghost" data-act="template" data-id="' + t.id + '">' + esc(t.name) + "</button>";
    }).join("") + "</div>";
    const cron = f.cronOn ? '<div class="field"><label for="cron-field">Cron expression</label><input id="cron-field" data-field="form:cron" value="' + esc(f.cron || "") + '" spellcheck="false"><div class="need-k" style="margin-top:6px">This expression is what gets saved.</div></div>' : "";
    const extra = f.mode === "edit"
      ? '<div class="r-actions" style="margin-top:8px"><button type="button" class="ghost" data-act="pause" data-id="' + f.id + '">' + ((routines.filter(function (r) { return r.id === f.id; })[0] || {}).paused ? "Resume" : "Pause") + '</button>' +
        '<button type="button" class="ghost" data-act="run-now" data-id="' + f.id + '">Run now</button>' +
        '<button type="button" class="ghost" data-act="nav" data-to="#/routine/runs/' + f.id + '">History</button>' +
        (state.confirmDelete === "job:" + f.id
          ? '<span class="confirm">Delete this routine?<button type="button" class="text-btn" data-act="delete-job" data-id="' + f.id + '">Delete</button><button type="button" class="text-btn" data-act="delete-no">Cancel</button></span>'
          : '<button type="button" class="ghost" data-act="delete-ask" data-id="job:' + f.id + '">Delete</button>') +
        "</div>" : "";
    const body = '<div class="pane"><div class="page">' + templates + botsel +
      '<div class="field"><label for="r-name">Name</label><input id="r-name" data-field="form:name" value="' + esc(f.name) + '"></div>' +
      '<div class="field"><label for="r-prompt">Instructions</label><textarea id="r-prompt" rows="4" data-field="form:prompt">' + esc(f.prompt) + "</textarea></div>" +
      '<div class="field"><div class="lbl">Schedule</div><div class="seg">' + segs + "</div></div>" +
      '<div class="field"><label for="r-time">Time</label><input id="r-time" type="time" data-field="form:time" value="' + esc(f.time) + '"></div>' +
      days + once +
      '<p class="need-k">' + esc(schedLabel(f)) + '</p>' +
      '<button type="button" class="text-btn" data-act="toggle-cron">' + (f.cronOn ? "Hide cron" : "Advanced: cron") + "</button>" + cron +
      '<div class="field" style="margin-top:12px"><div class="lbl">Deliver to</div><div class="checks">' +
      '<button type="button" class="check" data-act="deliver" data-id="chat"><span class="toggle' + (f.chat ? " on" : "") + '"><i></i></span> This bot\'s chat</button>' +
      '<button type="button" class="check" data-act="deliver" data-id="ntfy"><span class="toggle' + (f.ntfy ? " on" : "") + '"><i></i></span> ntfy</button></div></div>' +
      (f.error ? '<div class="err">' + esc(f.error) + "</div>" : "") +
      '<div class="choices"><button type="button" class="primary" data-act="save-routine">Save</button>' +
      '<button type="button" class="ghost" data-act="nav" data-to="' + (backTarget() || "#/routines") + '">Cancel</button></div>' +
      extra + "</div></div>";
    return column(f.mode === "edit" ? "Edit routine" : "New routine", botName(f.bot), body);
  }
  function runsView(id) {
    const job = routines.filter(function (r) { return r.id === id; })[0];
    if (!job) return column("History", "", '<div class="pane"><div class="empty">That routine is gone.</div></div>');
    const rows = job.runs.length ? job.runs.map(function (r) {
      return '<div class="set-row"><div><b>' + esc(r.status) + "</b> · " + esc(r.when) + '<div class="sub">' + esc(r.detail) + "</div></div>" +
        (r.chat ? '<button type="button" class="text-btn" data-act="nav" data-to="#/chat/' + job.bot + '">Open in chat</button>' : "") + "</div>";
    }).join("") : '<p class="lede">No runs yet.</p>';
    return column(job.name, schedLabel(job), '<div class="pane"><div class="page"><p class="lede">A run\'s output is the message in the chat. This list is only the outcome.</p>' + rows + "</div></div>");
  }

  function usageView() {
    const max = Math.max.apply(null, HB.usageDays);
    const maxBot = Math.max.apply(null, HB.usageByBot.map(function (x) { return x[1]; }));
    const bars = HB.usageDays.map(function (v) {
      return '<i class="bar" style="height:' + Math.max(4, Math.round(v / max * 100)) + '%"></i>';
    }).join("");
    const byBot = HB.usageByBot.map(function (pair) {
      return '<div class="u-row"><div>' + esc(botName(pair[0])) + '<div class="meter"><i style="width:' + Math.round(pair[1] / maxBot * 100) + '%"></i></div></div><span>' + money(pair[1]) + "</span></div>";
    }).join("");
    const chats = HB.usageChats.map(function (c) {
      return '<div class="u-row"><div>' + esc(c.title) + " · " + esc(botName(c.bot)) + "</div><span>" + money(c.cost) + "</span></div>";
    }).join("");
    const body = '<div class="pane"><div class="page"><h2>October</h2><p class="lede">$18.40 across the last 14 days, ending 27 Oct.</p>' +
      '<div class="bars">' + bars + '</div><div class="bar-labels"><span>14 Oct</span><span>27 Oct</span></div>' +
      '<div class="group-label">By bot</div>' + byBot +
      '<div class="group-label">By chat</div>' + chats +
      '<p class="need-k" style="margin-top:12px">Each finished reply also shows its own tokens and cost.</p></div></div>';
    return column("Usage", "Last 14 days", body);
  }
  function botView(botId) {
    const bot = botBy(botId) || bots[0];
    const face = state.faces[bot.id] || { type: "mark", id: bot.mark };
    const marks = HB.marks.map(function (id) {
      const on = face.type === "mark" && face.id === id;
      return '<button type="button" class="mark-btn' + (on ? " on" : "") + '" data-act="mark" data-bot="' + bot.id + '" data-id="' + id + '" aria-label="' + id + '">' +
        '<span class="av">' + svg(MARK[id], 22) + "</span></button>";
    }).join("");
    const body = '<div class="pane"><div class="page"><div class="hero">' + avatar(bot.id, { lg: true }) +
      '<button type="button" class="primary" data-act="pick-avatar">Upload a photo</button>' +
      '<input id="avatar-in" type="file" accept="image/*" hidden></div>' +
      '<div class="lbl">Or choose</div><div class="marks">' + marks + "</div>" +
      '<div class="static-row"><b>' + esc(bot.name) + "</b><span>" + esc(bot.about) + "</span></div>" +
      '<div class="static-row"><b>Model default</b><span>' + esc(bot.model) + " · " + esc(bot.effort) + "</span></div>" +
      '<p class="need-k">Change the model from the chip on the message box. That can apply to this chat, or to the bot\'s default. The face updates everywhere this bot appears.</p></div></div>';
    return column(bot.name, "Bot info", body);
  }
  function settingsView() {
    const theme = localStorage.getItem("hb-theme") || "system";
    const seg = ["system", "light", "dark"].map(function (k) {
      const label = k === "system" ? "System" : k === "light" ? "Light" : "Dark";
      return '<button type="button" class="' + (theme === k ? "on" : "") + '" data-act="theme" data-id="' + k + '">' + label + "</button>";
    }).join("");
    const rows = state.servers.map(function (s) {
      const cur = s.id === state.serverId;
      return '<div class="set-row"><div><b>' + esc(s.name) + "</b><div class=\"sub\">" + esc(s.host) + ":" + s.port + "</div></div>" +
        (cur ? '<span class="tag">Connected</span>' : '<button type="button" class="ghost" data-act="use-server" data-id="' + s.id + '">Use this server</button>') + "</div>";
    }).join("");
    const add = state.addServer;
    const body = '<div class="pane"><div class="page"><h2>Servers</h2><p class="lede">Tailscale only. Switching signs you in again. The username stays filled in.</p>' + rows +
      '<div class="group-label">Add a server</div>' +
      '<div class="field"><label for="sv-name">Name</label><input id="sv-name" data-field="add:name" value="' + esc(add.name) + '" placeholder="studio"></div>' +
      '<div class="field"><label for="sv-host">Address</label><input id="sv-host" data-field="add:host" value="' + esc(add.host) + '" placeholder="100.x.x.x" spellcheck="false"></div>' +
      '<div class="field"><label for="sv-port">Port</label><input id="sv-port" data-field="add:port" value="' + esc(add.port) + '" inputmode="numeric"></div>' +
      (add.error ? '<div class="err">' + esc(add.error) + "</div>" : "") +
      '<button type="button" class="primary" data-act="add-server">Add server</button>' +
      '<div class="group-label">Appearance</div><div class="seg" style="margin-bottom:12px">' + seg + "</div>" +
      '<div class="set-row"><div><b>Notifications</b><div class="sub">ntfy, when the app is closed</div></div><button type="button" class="text-btn" data-act="nav" data-to="#/notifications">Open</button></div>' +
      '<div class="set-row"><div><b>Hermes Bots ' + esc(version()) + '</b><div class="sub">' + (state.installed ? "Up to date" : "Update available · " + HB.nextVersion) + "</div></div>" +
      (state.installed ? "" : '<button type="button" class="ghost" data-act="nav" data-to="#/update">View</button>') + "</div>" +
      '<p class="need-k">API keys stay on the server. This app does not show them.</p></div></div>';
    return column("Settings", currentServer().name, body);
  }
  function notifView() {
    const toggles = HB.notifications.map(function (n) {
      const on = !!state.notif[n.id];
      return '<button type="button" class="set-row" data-act="notif" data-id="' + n.id + '"><span>' + esc(n.label) + '</span><span class="toggle' + (on ? " on" : "") + '"><i></i></span></button>';
    }).join("");
    const body = '<div class="pane"><div class="page"><h2>ntfy</h2><p class="lede">Alerts when this app is closed. Hermes sends them through ntfy. One topic, with a switch for each kind.</p>' +
      '<div class="field"><label for="ntfy-url">Server</label><input id="ntfy-url" data-field="ntfy-url" value="' + esc(state.ntfyUrl) + '" spellcheck="false"></div>' +
      '<div class="field"><label for="ntfy-topic">Topic</label><input id="ntfy-topic" data-field="ntfy-topic" value="' + esc(state.ntfyTopic) + '" spellcheck="false"></div>' +
      toggles + "</div></div>";
    return column("Notifications", "ntfy", body);
  }
  function loginView() {
    const server = state.pendingServer
      ? (state.servers.filter(function (s) { return s.id === state.pendingServer; })[0] || currentServer())
      : currentServer();
    const switching = !!state.pendingServer;
    const title = switching ? "Sign in to " + server.name : "Sign in again";
    const lede = switching
      ? "Switching servers needs your password. The username stays filled in."
      : "Your sign-in on this device expired.";
    return '<div class="login"><div class="login-card"><div class="wordmark" style="margin-bottom:18px">Hermes Bots</div>' +
      "<h1>" + esc(title) + "</h1><p class=\"lede\">" + esc(lede) + "</p>" +
      '<div class="server-line">' + esc(server.name) + " · " + esc(server.host) + ":" + server.port + "</div>" +
      '<div class="field"><label for="username">Username</label><input id="username" value="' + esc(state.loginUser) + '" autocomplete="username"></div>' +
      '<div class="field"><label for="password">Password</label><input id="password" type="password" value="' + esc(state.loginPass) + '" autocomplete="current-password"></div>' +
      (state.loginError ? '<div class="err">' + esc(state.loginError) + "</div>" : "") +
      '<button type="button" class="primary" data-act="login">Continue</button></div></div>';
  }
  function updateModal() {
    const inner = state.installed
      ? "<h2>Installed</h2><p>You're on " + esc(HB.nextVersion) + ". Restart the app when you can.</p>" +
        '<div class="choices"><button type="button" class="primary" data-act="nav" data-to="' + homeHash() + '">OK</button></div>'
      : "<h2>Update available</h2><p>Version " + esc(HB.nextVersion) + " is ready to install. You're on " + esc(HB.version) + ".</p>" +
        '<div class="choices"><button type="button" class="ghost" data-act="nav" data-to="' + homeHash() + '">Not now</button>' +
        '<button type="button" class="primary" data-act="install">Install</button></div>';
    return '<div class="modal-back"><div class="modal" role="dialog" aria-labelledby="upd-title">' + inner + "</div></div>";
  }

  function mainView() {
    const a = route.parts[0], b = route.parts[1], c = route.parts[2];
    if (a === "history") return historyView(b || "junior");
    if (a === "routines" && b) return routinesView(b);
    if (a === "routines") return routinesView(null);
    if (a === "routine" && (b === "new" || b === "edit")) return formView();
    if (a === "routine" && b === "runs") return runsView(c);
    if (a === "room") return roomColumn(b);
    if (a === "usage") return usageView();
    if (a === "bot") return botView(b || "junior");
    if (a === "settings") return settingsView();
    if (a === "notifications") return notifView();
    if (a === "chat") return chatColumn(b || "junior");
    return chatColumn("junior");
  }
  function inner() {
    const a = route.parts[0];
    if (a === "login") return loginView();
    if (a === "update") return device() === "phone" ? listPage() : '<div class="shell">' + sidebar() + chatColumn("junior") + "</div>";
    if (device() === "phone" && (!a || a === "bots")) return listPage();
    const main = mainView();
    if (device() === "phone") return main;
    return '<div class="shell">' + sidebar() + main + "</div>";
  }
  function chrome() {
    if (device() === "desktop") {
      return '<div class="titlebar"><span>Hermes Bots</span><span class="caption"><span>' + svg(IC.min, 14) + "</span><span>" + svg(IC.max, 12) + "</span><span>" + svg(IC.close, 14) + "</span></span></div>";
    }
    return '<div class="status"><span class="status-time">' + nowTime() + '</span><span class="status-icons">' + svg(IC.wifi, 16) + svg(IC.bat, 18) + "</span></div>";
  }
  function render(opt) {
    opt = opt || {};
    const prevPane = document.querySelector(".pane");
    const prevSide = document.querySelector(".side-scroll");
    const prev = { pane: prevPane ? prevPane.scrollTop : 0, side: prevSide ? prevSide.scrollTop : 0 };
    const focus = opt.focus || state.focusId;
    const focusAt = state.focusAt;
    document.getElementById("app").innerHTML = '<div class="app">' + chrome() + '<div class="fill">' + inner() + "</div>" +
      (route.parts[0] === "update" ? updateModal() : "") + "</div>";
    const pane = document.querySelector(".pane");
    const side = document.querySelector(".side-scroll");
    if (opt.scroll === "bottom" && pane) pane.scrollTop = pane.scrollHeight;
    else if (opt.scroll === "top") {
      if (pane) pane.scrollTop = 0;
      const card = document.querySelector(".clarify");
      if (card && pane) {
        const paneRect = pane.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        pane.scrollTop += cardRect.top - paneRect.top - 8;
      }
    }
    else {
      if (pane) pane.scrollTop = prev.pane;
      if (side) side.scrollTop = prev.side;
    }
    if (focus) {
      const el = document.getElementById(focus);
      if (el) {
        el.focus();
        if (focusAt != null && el.setSelectionRange) el.setSelectionRange(focusAt, focusAt);
      }
    }
    state.focusId = null;
    state.focusAt = null;
    const c = document.getElementById("composer");
    if (c) {
      c.style.height = "auto";
      c.style.height = Math.min(c.scrollHeight, 140) + "px";
    }
  }

  function copyText(text, btn) {
    function done() {
      if (!btn) return;
      const prev = btn.textContent;
      btn.textContent = "Copied";
      setTimeout(function () { btn.textContent = prev; }, 1200);
    }
    function fallback() {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (e) { /* ignore */ }
      ta.remove();
      done();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(fallback);
    else fallback();
  }
  function messagePlain(m) {
    if (!m) return "";
    if (m.code) return m.code.text;
    return m.text || "";
  }

  function doStop(bot) {
    bot.working = false;
    const list = currentThread(bot.id);
    const m = list.filter(function (x) { return x.streaming; })[0];
    if (m) {
      m.streaming = false;
      if (m.thinking) { m.thinking.streaming = false; m.thinking.open = false; }
      (m.tools || []).forEach(function (t) {
        if (t.running) {
          t.running = false;
          t.line = "Stopped: gh run view 1842";
          t.output = "Stopped before the log came back.";
        }
      });
      m.text = "Stopped before the log came back.";
      m.usage = { tokens: 760, cost: 0.02 };
      bot.preview = "Stopped before the log came back.";
    }
    render({ preserve: true });
  }
  function doSteer(bot) {
    const text = state.steer.trim();
    if (!text || !bot) return;
    currentThread(bot.id).push({ id: uid(), role: "system", text: "Steered · " + text });
    state.steer = "";
    render({ scroll: "bottom" });
  }
  function imageAtt() { return state.attachments.filter(function (a) { return a.kind === "image"; })[0] || null; }
  function fileAtt() { return state.attachments.filter(function (a) { return a.kind === "file"; })[0] || null; }
  function doSend(bot) {
    const text = state.composer.trim();
    const atts = state.attachments.slice();
    if (!text && !atts.length) return;
    if (bot.working) {
      if (text) bot.queue.push(text);
      atts.forEach(function (a) { bot.queue.push((a.kind === "image" ? "Image: " : "File: ") + a.name); });
      state.composer = "";
      state.attachments = [];
      state.replyTo = null;
      render({ preserve: true, focus: "composer" });
      return;
    }
    const img = imageAtt();
    const file = fileAtt();
    const list = currentThread(bot.id);
    state.minute += 1;
    const sess = sessionOf(bot.id);
    list.push({
      id: uid(), role: "user", time: nowTime(), text: text, replyTo: state.replyTo,
      image: img && img.src, imageName: img && img.name,
      file: file ? { name: file.name, size: file.size || "" } : null
    });
    if (sess && !sess.main && sess.title === "New chat") {
      const t = text || "Attachment";
      sess.title = t.length > 42 ? t.slice(0, 42) + "…" : t;
      sess.auto = true;
    }
    if (sess) {
      sess.preview = (text || "Attachment").slice(0, 80);
      sess.sort = Date.now();
      sess.when = "Today";
    }
    list.push({
      id: uid(), role: "assistant", who: bot.id, time: nowTime(),
      thinking: { seconds: 1, open: false, text: "Short enough to answer directly." },
      text: "I'll pick that up in this chat.",
      usage: { tokens: 86, cost: 0.01 }
    });
    bot.preview = text ? text.slice(0, 90) : "Attachment";
    bot.time = nowTime();
    bot.activity = 1000 + state.minute;
    bot.unread = 0;
    state.composer = "";
    state.attachments = [];
    state.replyTo = null;
    render({ scroll: "bottom", focus: "composer" });
  }
  function doSendRoom(room) {
    const text = state.composer.trim();
    if (!text && !state.attachments.length) return;
    const img = imageAtt();
    state.minute += 1;
    (roomLogs[room.id] = roomLogs[room.id] || []).push({
      id: uid(), role: "user", time: nowTime(), text: text,
      image: img && img.src, imageName: img && img.name
    });
    room.preview = "You: " + (text || "Attachment").slice(0, 72);
    state.composer = "";
    state.attachments = [];
    render({ scroll: "bottom", focus: "composer" });
  }
  function runCommand(name, bot) {
    state.composer = "";
    if (!bot) return;
    if (name === "new") { createSide(bot.id); return; }
    if (name === "routine") { location.hash = "#/routine/new?bot=" + bot.id; return; }
    if (name === "model" || name === "effort") {
      state.modelOpen = true;
      state.modelScope = "chat";
      render({ preserve: true });
      return;
    }
    if (name === "compact") {
      currentThread(bot.id).push({ id: uid(), role: "system", text: "Earlier messages were summarized." });
      render({ scroll: "bottom" });
      return;
    }
    if (name === "stop") {
      if (bot.working) doStop(bot);
      else {
        currentThread(bot.id).push({ id: uid(), role: "system", text: "Nothing is running." });
        render({ scroll: "bottom" });
      }
    }
  }
  function createSide(botId) {
    const id = uid();
    sessions[botId].push({
      id: id, title: "New chat", main: false, pinned: false, auto: false, when: "Today", preview: "Empty", sort: Date.now()
    });
    threads[botId + ":" + id] = [];
    state.session[botId] = id;
    const next = "#/chat/" + botId;
    if (location.hash === next) {
      route = parse();
      onRoute();
      render({ scroll: "top" });
    } else location.hash = next;
  }
  function enterComposer() {
    if (state.composer.startsWith("/")) {
      const items = filteredCommands();
      const pick = items[state.slashIndex] || items[0];
      if (pick && activeBot()) { runCommand(pick.name, activeBot()); return; }
    }
    const room = activeRoom();
    if (room) doSendRoom(room);
    else if (activeBot()) doSend(activeBot());
  }
  function runNow(id) {
    const job = routines.filter(function (r) { return r.id === id; })[0];
    if (!job) return;
    const name = botName(job.bot);
    job.runs.unshift({ when: "Just now", status: "Succeeded", detail: "Posted into " + name + "'s main chat.", chat: true });
    const key = job.bot + ":main";
    if (!threads[key]) threads[key] = [];
    state.minute += 1;
    threads[key].push({ id: uid(), role: "routine", who: job.bot, routine: job.name, time: nowTime(), text: job.result || "Ran just now." });
    const b = botBy(job.bot);
    if (b) {
      b.preview = (job.result || "Ran just now.").slice(0, 90);
      b.time = nowTime();
      b.activity = 1000 + state.minute;
    }
    state.toast = { text: "Posted into " + name + "'s main chat.", to: "#/chat/" + job.bot };
    render({ preserve: true });
    setTimeout(function () {
      state.toast = null;
      const el = document.getElementById("toast");
      if (el) el.remove();
    }, 5000);
  }
  function saveForm() {
    const f = state.form;
    if (!f.name || !f.name.trim()) { f.error = "Name the routine."; render({ preserve: true }); return; }
    const cron = (f.cronDirty || f.cronOn) ? (f.cron || toCron(f)) : toCron(f);
    if (f.mode === "new") {
      routines.unshift({
        id: uid(), bot: f.bot, name: f.name.trim(), prompt: f.prompt, freq: f.freq, time: f.time,
        onceDate: f.onceDate, days: (f.days || []).slice(), cron: cron, cronDirty: !!f.cronDirty,
        chat: !!f.chat, ntfy: !!f.ntfy, paused: false, result: "Ran just now. Posted into this chat.", runs: []
      });
    } else {
      const j = routines.filter(function (r) { return r.id === f.id; })[0];
      if (j) Object.assign(j, {
        name: f.name.trim(), prompt: f.prompt, freq: f.freq, time: f.time, onceDate: f.onceDate,
        days: (f.days || []).slice(), cron: cron, cronDirty: !!f.cronDirty, chat: !!f.chat, ntfy: !!f.ntfy
      });
    }
    location.hash = "#/routines/" + f.bot;
  }
  function addFiles(list) {
    const files = Array.prototype.slice.call(list || []);
    if (!files.length) return;
    let left = files.length;
    function done() { if (--left === 0) render({ preserve: true, focus: "composer" }); }
    files.forEach(function (file) {
      if (file.type && file.type.indexOf("image/") === 0) {
        const reader = new FileReader();
        reader.onload = function () {
          state.attachments.push({ id: uid(), kind: "image", name: file.name || "Pasted image", src: reader.result });
          done();
        };
        reader.readAsDataURL(file);
      } else {
        state.attachments.push({ id: uid(), kind: "file", name: file.name, size: prettySize(file.size) });
        done();
      }
    });
  }
  function syncSend() {
    const has = canSend();
    const send = document.getElementById("send-btn");
    if (send) send.disabled = !has;
    const q = document.getElementById("queue-btn");
    if (q) q.hidden = !has;
  }
  function onComposer(el) {
    state.composer = el.value;
    state.slashIndex = 0;
    const host = document.getElementById("slash-host");
    if (host) host.innerHTML = slashMenu();
    syncSend();
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }

  const ACT = {
    nav: function (el) { location.hash = el.dataset.to; },
    "open-bot": function (el) {
      const b = botBy(el.dataset.id);
      if (b) b.unread = 0;
      state.session[el.dataset.id] = state.session[el.dataset.id] || "main";
      location.hash = "#/chat/" + el.dataset.id;
    },
    menu: function () { state.menu = !state.menu; render({ preserve: true }); },
    think: function (el) {
      const m = findMessage(el.dataset.id);
      const cur = m ? thinkOpen(m) : false;
      state.openThink[el.dataset.id] = !cur;
      render({ preserve: true });
    },
    tool: function (el) {
      state.openTool[el.dataset.id] = !state.openTool[el.dataset.id];
      render({ preserve: true });
    },
    "copy-msg": function (el) {
      const m = findMessage(el.dataset.id);
      copyText(messagePlain(m) || (m && m.html ? m.html.replace(/<[^>]+>/g, " ") : ""), el);
    },
    "copy-code": function (el) {
      const m = findMessage(el.dataset.id);
      if (m && m.code) copyText(m.code.text, el);
    },
    retry: function (el) {
      const id = el.dataset.id;
      state.retrying = id;
      render({ preserve: true });
      setTimeout(function () { state.retrying = null; state.retried[id] = true; render({ preserve: true }); }, 800);
    },
    reply: function (el) { state.replyTo = el.dataset.id; render({ preserve: true, focus: "composer" }); },
    "clear-reply": function () { state.replyTo = null; render({ preserve: true, focus: "composer" }); },
    send: function () { enterComposer(); },
    stop: function () { const b = activeBot(); if (b) doStop(b); },
    steer: function () { doSteer(activeBot()); },
    unqueue: function (el) {
      const b = activeBot();
      if (b && b.queue) b.queue.splice(parseInt(el.dataset.id, 10), 1);
      render({ preserve: true });
    },
    "pick-file": function () { const n = document.getElementById("file-in"); if (n) n.click(); },
    "paste-sample": function () {
      state.attachments.push({ id: uid(), kind: "image", name: "Pasted image", src: HB.photo });
      render({ preserve: true, focus: "composer" });
    },
    unattach: function (el) {
      state.attachments = state.attachments.filter(function (a) { return a.id !== el.dataset.id; });
      render({ preserve: true, focus: "composer" });
    },
    "slash-ins": function () {
      if (state.composer.indexOf("/") !== 0) state.composer = "/" + state.composer;
      render({ preserve: true, focus: "composer" });
    },
    slash: function (el) { runCommand(el.dataset.id, activeBot()); },
    "toggle-model": function () { state.modelOpen = !state.modelOpen; render({ preserve: true }); },
    scope: function (el) { state.modelScope = el.dataset.id; render({ preserve: true }); },
    "pick-model": function (el) {
      const bot = activeBot();
      if (!bot) return;
      if (state.modelScope === "bot") bot.model = el.dataset.id;
      else state.overrides[chatKey(bot.id)] = Object.assign({}, state.overrides[chatKey(bot.id)], { model: el.dataset.id });
      render({ preserve: true });
    },
    "pick-effort": function (el) {
      const bot = activeBot();
      if (!bot) return;
      if (state.modelScope === "bot") bot.effort = el.dataset.id;
      else state.overrides[chatKey(bot.id)] = Object.assign({}, state.overrides[chatKey(bot.id)], { effort: el.dataset.id });
      render({ preserve: true });
    },
    "approval-expand": function () { state.approvalOpen = !state.approvalOpen; render({ preserve: true }); },
    approve: function (el) {
      state.approvalChoice = el.dataset.id;
      const b = botBy("ledger");
      if (b) b.needs = null;
      render({ preserve: true });
    },
    opt: function (el) {
      const qid = el.dataset.q;
      const cur = state.clarify[qid] || { opts: [], text: "" };
      const opt = el.dataset.id;
      if (el.dataset.multi === "1") {
        const i = cur.opts.indexOf(opt);
        if (i >= 0) cur.opts.splice(i, 1); else cur.opts.push(opt);
      } else cur.opts = cur.opts[0] === opt ? [] : [opt];
      state.clarify[qid] = cur;
      render({ preserve: true });
    },
    "clarify-send": function () {
      state.clarifySent = true;
      const b = botBy("atlas");
      if (b) { b.needs = null; b.unread = 0; }
      render({ preserve: true });
    },
    "open-session": function (el) {
      state.session[el.dataset.bot] = el.dataset.id;
      location.hash = "#/chat/" + el.dataset.bot;
    },
    "row-menu": function (el) {
      state.rowMenu = state.rowMenu === el.dataset.id ? null : el.dataset.id;
      state.confirmDelete = null;
      render({ preserve: true });
    },
    pin: function (el) {
      const s = (sessions[el.dataset.bot] || []).filter(function (x) { return x.id === el.dataset.id; })[0];
      if (s && !s.main) s.pinned = !s.pinned;
      state.rowMenu = null;
      render({ preserve: true });
    },
    rename: function (el) {
      const s = (sessions[el.dataset.bot] || []).filter(function (x) { return x.id === el.dataset.id; })[0];
      if (!s) return;
      state.renaming = s.id;
      state.renameValue = s.title;
      state.rowMenu = null;
      state.focusId = "rename";
      render({ preserve: true });
    },
    archive: function (el) {
      const s = (sessions[el.dataset.bot] || []).filter(function (x) { return x.id === el.dataset.id; })[0];
      if (s && !s.main) s.archived = !s.archived;
      state.rowMenu = null;
      render({ preserve: true });
    },
    "delete-ask": function (el) { state.confirmDelete = el.dataset.id; state.rowMenu = null; render({ preserve: true }); },
    "delete-no": function () { state.confirmDelete = null; render({ preserve: true }); },
    "delete-yes": function (el) {
      const botId = el.dataset.bot;
      sessions[botId] = (sessions[botId] || []).filter(function (s) { return s.id !== el.dataset.id; });
      if (state.session[botId] === el.dataset.id) state.session[botId] = "main";
      state.confirmDelete = null;
      render({ preserve: true });
    },
    "toggle-arch": function () { state.showArchived = !state.showArchived; render({ preserve: true }); },
    "new-side": function (el) { createSide(el.dataset.id); },
    pause: function (el) {
      const j = routines.filter(function (r) { return r.id === el.dataset.id; })[0];
      if (j) j.paused = !j.paused;
      render({ preserve: true });
    },
    "run-now": function (el) { runNow(el.dataset.id); },
    template: function (el) {
      const t = HB.templates.filter(function (x) { return x.id === el.dataset.id; })[0];
      if (!t || !state.form) return;
      const keep = { mode: state.form.mode, id: state.form.id, bot: state.form.bot };
      state.form = {
        mode: keep.mode, id: keep.id, bot: keep.bot, name: t.name, prompt: t.prompt,
        freq: t.freq === "cron" ? "cron" : t.freq, time: t.time || "07:00",
        onceDate: "2026-10-27", days: (t.days || []).slice(),
        cron: t.cron || toCron(t), cronDirty: t.freq === "cron", cronOn: t.freq === "cron",
        chat: !!t.chat, ntfy: !!t.ntfy, error: ""
      };
      render({ preserve: true });
    },
    freq: function (el) {
      state.form.freq = el.dataset.id;
      if (state.form.freq === "weekdays") state.form.days = [1, 2, 3, 4, 5];
      if (state.form.freq === "daily") state.form.days = [0, 1, 2, 3, 4, 5, 6];
      if (!state.form.cronDirty) state.form.cron = toCron(state.form);
      render({ preserve: true });
    },
    day: function (el) {
      const d = parseInt(el.dataset.id, 10);
      const days = state.form.days;
      const i = days.indexOf(d);
      if (i >= 0) days.splice(i, 1); else days.push(d);
      state.form.freq = "weekly";
      if (!state.form.cronDirty) state.form.cron = toCron(state.form);
      render({ preserve: true });
    },
    "toggle-cron": function () {
      state.form.cronOn = !state.form.cronOn;
      if (!state.form.cron) state.form.cron = toCron(state.form);
      render({ preserve: true });
    },
    deliver: function (el) {
      if (el.dataset.id === "chat") state.form.chat = !state.form.chat;
      if (el.dataset.id === "ntfy") state.form.ntfy = !state.form.ntfy;
      render({ preserve: true });
    },
    "save-routine": function () { saveForm(); },
    "delete-job": function (el) {
      const i = routines.findIndex(function (r) { return r.id === el.dataset.id; });
      const bot = i >= 0 ? routines[i].bot : "junior";
      if (i >= 0) routines.splice(i, 1);
      state.confirmDelete = null;
      location.hash = "#/routines/" + bot;
    },
    mark: function (el) {
      state.faces[el.dataset.bot] = { type: "mark", id: el.dataset.id };
      render({ preserve: true });
    },
    "pick-avatar": function () { const n = document.getElementById("avatar-in"); if (n) n.click(); },
    theme: function (el) {
      const t = el.dataset.id;
      try { localStorage.setItem("hb-theme", t); } catch (e) { /* ignore */ }
      applyTheme(t);
      render({ preserve: true });
    },
    "use-server": function (el) { location.hash = "#/login?reason=switch&server=" + el.dataset.id; },
    "add-server": function () {
      const a = state.addServer;
      if (!a.name.trim() || !a.host.trim()) { a.error = "Name and address are both required."; render({ preserve: true }); return; }
      const port = parseInt(a.port, 10) || 9119;
      state.servers.push({ id: uid(), name: a.name.trim(), host: a.host.trim(), port: port });
      state.addServer = { name: "", host: "", port: "9119", error: "" };
      render({ preserve: true });
    },
    notif: function (el) { state.notif[el.dataset.id] = !state.notif[el.dataset.id]; render({ preserve: true }); },
    login: function () {
      if (!state.loginPass) { state.loginError = "Enter your password."; render({ preserve: true, focus: "password" }); return; }
      if (state.pendingServer) state.serverId = state.pendingServer;
      state.pendingServer = null;
      state.loginPass = "";
      state.loginError = "";
      location.hash = homeHash();
    },
    install: function () { state.installed = true; render({ preserve: true }); },
    reconnect: function () {
      state.reconnect = "ok";
      render({ preserve: true });
      setTimeout(function () {
        if (state.reconnect === "ok") { state.reconnect = null; render({ preserve: true }); }
      }, 1600);
    }
  };

  function commitRename() {
    if (!state.renaming) return;
    const id = state.renaming;
    let found = null;
    Object.keys(sessions).forEach(function (k) {
      const s = sessions[k].filter(function (x) { return x.id === id; })[0];
      if (s) found = s;
    });
    if (found) {
      const next = (state.renameValue || "").trim();
      if (next) { found.title = next; found.auto = false; }
    }
    state.renaming = null;
    render({ preserve: true });
  }

  function bind() {
    const app = document.getElementById("app");
    app.addEventListener("click", function (e) {
      const el = e.target.closest("[data-act]");
      if (el && app.contains(el)) {
        const fn = ACT[el.dataset.act];
        if (fn) fn(el, e);
        return;
      }
      let changed = false;
      if (state.modelOpen && !e.target.closest(".pop") && !e.target.closest(".composer-box") && !e.target.closest(".model-chip")) { state.modelOpen = false; changed = true; }
      if (state.menu && !e.target.closest(".sheet")) { state.menu = false; changed = true; }
      if (state.rowMenu && !e.target.closest(".menu")) { state.rowMenu = null; changed = true; }
      if (changed) render({ preserve: true });
    });
    app.addEventListener("input", function (e) {
      const t = e.target;
      if (t.id === "composer") { onComposer(t); return; }
      if (t.id === "hist-q") {
        state.histQ = t.value;
        state.focusId = "hist-q";
        state.focusAt = t.selectionStart;
        render({ preserve: true });
        return;
      }
      if (t.id === "steer") {
        state.steer = t.value;
        const b = document.getElementById("steer-btn");
        if (b) b.disabled = !t.value.trim();
        return;
      }
      if (t.id === "password") { state.loginPass = t.value; return; }
      if (t.id === "username") { state.loginUser = t.value; return; }
      if (t.id === "rename") { state.renameValue = t.value; return; }
      if (t.id === "form-bot") { if (state.form) state.form.bot = t.value; return; }
      const f = t.dataset.field || "";
      if (f.indexOf("clarify:") === 0) {
        const qid = f.slice(8);
        const cur = state.clarify[qid] || { opts: [], text: "" };
        cur.text = t.value;
        state.clarify[qid] = cur;
        return;
      }
      if (f.indexOf("form:") === 0) {
        const key = f.slice(5);
        if (!state.form) return;
        state.form[key] = t.value;
        if (key === "cron") state.form.cronDirty = true;
        if ((key === "time" || key === "onceDate") && !state.form.cronDirty) {
          state.form.cron = toCron(state.form);
          const c = document.getElementById("cron-field");
          if (c && document.activeElement !== c) c.value = state.form.cron;
        }
        return;
      }
      if (f.indexOf("add:") === 0) { state.addServer[f.slice(4)] = t.value; return; }
      if (f === "ntfy-url") state.ntfyUrl = t.value;
      if (f === "ntfy-topic") state.ntfyTopic = t.value;
    });
    app.addEventListener("change", function (e) {
      if (e.target.id === "file-in") { addFiles(e.target.files); e.target.value = ""; }
      if (e.target.id === "avatar-in" && e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const reader = new FileReader();
        const botId = route.parts[0] === "bot" ? route.parts[1] : "junior";
        reader.onload = function () { state.faces[botId] = { type: "img", src: reader.result }; render({ preserve: true }); };
        reader.readAsDataURL(file);
        e.target.value = "";
      }
      if (e.target.id === "form-bot" && state.form) state.form.bot = e.target.value;
    });
    app.addEventListener("keydown", function (e) {
      const t = e.target;
      if (t.id === "composer") {
        if ((e.key === "ArrowDown" || e.key === "ArrowUp") && state.composer.indexOf("/") === 0) {
          e.preventDefault();
          const items = filteredCommands();
          if (!items.length) return;
          state.slashIndex = (state.slashIndex + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
          const host = document.getElementById("slash-host");
          if (host) host.innerHTML = slashMenu();
          return;
        }
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enterComposer(); }
        return;
      }
      if (t.id === "password" && e.key === "Enter") ACT.login();
      if (t.id === "rename" && e.key === "Enter") { e.preventDefault(); commitRename(); }
    });
    app.addEventListener("focusout", function (e) {
      if (e.target.id === "rename") setTimeout(commitRename, 0);
    });
    document.addEventListener("paste", function (e) {
      if (!e.clipboardData) return;
      const items = e.clipboardData.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf("image/") === 0) {
          const file = items[i].getAsFile();
          if (file) { addFiles([file]); e.preventDefault(); }
          break;
        }
      }
    });
    window.addEventListener("storage", function (e) {
      if (e.key === "hb-theme") applyTheme(e.newValue || "system");
    });
  }

  function tick() {
    if (state.approvalChoice || state.approvalLeft <= 0) return;
    state.approvalLeft -= 1;
    const label = "Auto-denies in " + clock(state.approvalLeft);
    const a = document.getElementById("approval-timer");
    const n = document.getElementById("need-timer");
    if (a) a.textContent = label;
    if (n) n.textContent = clock(state.approvalLeft);
    if (state.approvalLeft <= 0) {
      state.approvalChoice = "auto";
      const b = botBy("ledger");
      if (b) b.needs = null;
      render({ preserve: true });
    }
  }

  window.addEventListener("hashchange", function () {
    route = parse();
    onRoute();
    if (ready) render({ scroll: "top" });
  });

  function boot() {
    applyTheme(localStorage.getItem("hb-theme") || "system");
    if (!location.hash) location.hash = homeHash();
    route = parse();
    onRoute();
    bind();
    ready = true;
    render({ scroll: "top" });
    setInterval(tick, 1000);
  }
  boot();
})();

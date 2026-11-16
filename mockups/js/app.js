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
  const deletedBots = HB.deletedBots.map(function (b) { return Object.assign({}, b); });
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

  const files = { user: Object.assign({}, HB.files.user), bots: JSON.parse(JSON.stringify(HB.files.bots)) };
  const notes = JSON.parse(JSON.stringify(HB.notes));
  const botChats = JSON.parse(JSON.stringify(HB.botChats));
  const LIMITS = { USER_PROFILE: 4000, USER_MEMORY: 2000, BOT_PROFILE: 6000, BOT_MEMORY: 4000 };
  const FILE_INFO = {
    USER_PROFILE: "About you, for every bot. Only you write this.",
    USER_MEMORY: "What the bots have learned about you. Only the main bot writes this, and every edit asks you first. Other bots ask the main bot to record things.",
    BOT_PROFILE: "This bot's purpose and instructions. Only you write this.",
    BOT_MEMORY: "What this bot keeps for itself. Every edit it makes asks you first."
  };

  const state = {
    faces: {},
    overrides: {},
    modelScope: "chat",
    modelOpen: false,
    composer: "",
    attachments: [],
    replyTo: null,
    steer: "",
    slashIndex: 0,
    highlight: null,
    highlightBot: null,
    openThink: {},
    openTool: {},
    approvalOpen: false,
    approvalChoice: null,
    approvalLeft: 47 * 60 + 12,
    clarify: {},
    clarifySent: false,
    confirmDelete: null,
    form: null,
    toast: null,
    view: "",
    reconnect: null,
    menu: false,
    proposals: HB.memoryProposals.map(function (p) { return Object.assign({}, p); }),
    memFile: {},
    memSaved: null,
    memError: "",
    noteQuery: "",
    noteSaved: false,
    stepIn: {},
    stepText: "",
    botCfg: {},
    newBot: { name: "", description: "", purpose: "", model: HB.models[1], folder: "", error: "" },
    addMcp: { name: "", url: "", error: "" },
    providers: HB.providers.map(function (p) { return Object.assign({}, p); }),
    addKey: { open: null, provider: HB.providerNames[0], method: "key", key: "", callback: "", claudePath: "", claudeDir: "", usageLabel: "Default", error: "" },
    setup: { step: 0, url: "", password: "", provider: HB.providerNames[0], method: "key", key: "", callback: "", claudePath: "", claudeDir: "", usageLabel: "Default", main: "Junior", hostShell: false, error: "" },
    notif: {},
    loginUser: HB.user,
    loginPass: "",
    loginError: "",
    pendingServer: null,
    addServer: { name: "", host: "", port: "443", error: "" },
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
  function botName(id) {
    const b = botBy(id) || deletedBots.filter(function (d) { return d.id === id; })[0];
    return b ? b.name : "Bot";
  }
  function orderedBots() {
    return bots.filter(function (b) { return b.pinned; }).concat(
      bots.filter(function (b) { return !b.pinned; }).sort(function (a, b) { return b.activity - a.activity; })
    );
  }
  function currentServer() {
    return state.servers.filter(function (s) { return s.id === state.serverId; })[0] || state.servers[0];
  }
  function version() { return state.installed ? HB.nextVersion : HB.version; }
  function chatKey(botId) { return botId + ":main"; }
  function effective(bot) {
    const o = state.overrides[chatKey(bot.id)] || {};
    return {
      model: o.model || bot.model,
      effort: o.effort || bot.effort,
      custom: !!(o.model || o.effort)
    };
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
    if (job.chat && job.ntfy) return "This bot's chat · alert";
    if (job.chat) return "This bot's chat";
    if (job.ntfy) return "Alert only";
    return "Nowhere yet";
  }
  function showNeeds(b) {
    if (b.needs === "approval" && !state.approvalChoice) return true;
    if (b.needs === "question" && !state.clarifySent) return true;
    return state.proposals.some(function (p) { return p.bot === b.id; });
  }
  function needsItems() {
    const out = [];
    orderedBots().forEach(function (b) {
      if (b.needs === "approval" && !state.approvalChoice) out.push({ bot: b, kind: "approval" });
      if (b.needs === "question" && !state.clarifySent) out.push({ bot: b, kind: "question" });
      state.proposals.filter(function (p) { return p.bot === b.id; }).forEach(function (p) {
        out.push({ bot: b, kind: "memory", proposal: p });
      });
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
      cronDirty: false, cronOn: false, chat: true, ntfy: true, memory: false, error: ""
    };
  }
  function formFrom(id) {
    const j = routines.filter(function (r) { return r.id === id; })[0];
    if (!j) return blankForm("junior");
    return {
      mode: "edit", id: j.id, bot: j.bot, name: j.name, prompt: j.prompt, freq: j.freq,
      time: j.time, onceDate: j.onceDate || "2026-10-27", days: (j.days || []).slice(),
      cron: j.cron || toCron(j), cronDirty: !!j.cronDirty, cronOn: !!j.cronDirty || j.freq === "cron",
      chat: !!j.chat, ntfy: !!j.ntfy, memory: !!j.memory, error: ""
    };
  }
  function onRoute() {
    const view = route.q.get("view") || "";
    state.view = view;
    state.modelOpen = view === "model";
    state.menu = false;
    state.reconnect = view === "reconnect" ? "down" : null;
    state.composer = "";
    state.slashIndex = 0;
    if (view === "slash") {
      state.composer = "/";
      state.focusId = "composer";
    }
    if (view === "attach") {
      state.attachments = [
        { id: "seed-img", kind: "image", name: "Pasted image", src: HB.photo },
        { id: "seed-pdf", kind: "file", name: "invoice.pdf", size: "84 KB" }
      ];
      if (!threads["junior:attach"]) threads["junior:attach"] = JSON.parse(JSON.stringify(HB.attachThread));
    } else state.attachments = [];
    state.replyTo = null;
    state.memSaved = null;
    state.memError = "";
    state.noteSaved = false;
    state.noteQuery = "";
    state.confirmDelete = null;
    const a = route.parts[0], b = route.parts[1], c = route.parts[2];
    if (!(a === "chat" && b === state.highlightBot && state.highlight)) {
      state.highlight = null;
      state.highlightBot = null;
    }
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
    if (!a || a === "bots" || a === "login" || a === "update" || a === "setup") return null;
    if (a === "chat" || a === "room") return phone ? "#/bots" : null;
    if (a === "bot") return b === "new" ? home : "#/chat/" + b;
    if (a === "memory" || a === "bot-settings") return "#/bot/" + b;
    if (a === "notes") return c ? "#/notes/" + b : "#/bot/" + b;
    if (a === "convo") return "#/chat/" + (route.q.get("from") || b.split("-")[0]);
    if (a === "providers") return "#/settings";
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
    if (name === "settings") return a === "settings" || a === "notifications" || a === "providers";
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
    const on = (route.parts[0] === "chat" && route.parts[1] === b.id) || (route.parts[0] === "bot" && route.parts[1] === b.id);
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
    const names = r.members.filter(botBy).map(botName).join(", ");
    return '<button type="button" class="room-row' + (on ? " on" : "") + '" data-act="nav" data-to="#/room/' + r.id + '">' +
      roomAvatar() +
      '<span class="bot-mid"><span class="bot-name">' + esc(r.name) + '</span><span class="bot-sub">' + esc(names) + '</span><span class="bot-preview">' + esc(r.preview) + "</span></span><span></span></button>";
  }
  function needRow(item) {
    const b = item.bot;
    if (item.kind === "memory") {
      return '<button type="button" class="need-row" data-act="nav" data-to="#/memory/' + b.id + '"><i class="work-dot"></i><span class="need-mid"><span class="need-k">' + esc(b.name) + " · Memory edit</span>" +
        '<span class="need-sub">' + esc(item.proposal.file) + ".md: " + esc(item.proposal.add) + "</span></span></button>";
    }
    const label = item.kind === "approval" ? "Approval" : "Question";
    const sub = item.kind === "approval" ? HB.approval.title : HB.questions[0].prompt;
    const timer = item.kind === "approval" ? '<span class="bot-time" id="need-timer">' + clock(state.approvalLeft) + "</span>" : "";
    return '<button type="button" class="need-row" data-act="open-bot" data-id="' + b.id + '"><i class="work-dot"></i><span class="need-mid"><span class="need-k">' + esc(b.name) + " · " + label + '</span><span class="need-sub">' + esc(sub) + "</span></span>" + timer + "</button>";
  }
  function sidebar() {
    const needs = needsItems();
    return '<aside class="sidebar"><div class="side-top"><div class="wordmark">Botsman</div></div>' +
      (needs.length ? '<div style="padding:0 8px"><div class="side-label">Needs you</div>' + needs.map(needRow).join("") + "</div>" : "") +
      '<div class="side-scroll"><div class="side-label">Bots</div>' + orderedBots().map(botRow).join("") +
      '<button type="button" class="text-btn new-bot" data-act="nav" data-to="#/bot/new">New bot</button>' +
      '<div class="side-label">Channels</div>' + rooms.map(roomRow).join("") + "</div>" +
      '<div class="side-foot">' +
      '<button type="button" class="foot-btn' + (footOn("routines") ? " on" : "") + '" data-act="nav" data-to="#/routines">Routines</button>' +
      '<button type="button" class="foot-btn' + (footOn("usage") ? " on" : "") + '" data-act="nav" data-to="#/usage">Usage</button>' +
      '<button type="button" class="foot-btn' + (footOn("settings") ? " on" : "") + '" data-act="nav" data-to="#/settings">Settings</button>' +
      '<div class="conn">Connected to ' + esc(currentServer().name) + "</div></div></aside>";
  }
  function listPage() {
    const needs = needsItems();
    return '<div class="list-page pane"><div class="list-head"><div class="wordmark">Botsman</div></div>' +
      '<div class="phone-links"><button type="button" data-act="nav" data-to="#/routines">Routines</button>' +
      '<button type="button" data-act="nav" data-to="#/usage">Usage</button>' +
      '<button type="button" data-act="nav" data-to="#/settings">Settings</button></div>' +
      (needs.length ? '<div class="list-block"><div class="side-label">Needs you</div>' + needs.map(needRow).join("") + "</div>" : "") +
      '<div class="list-block"><div class="side-label">Bots</div>' + orderedBots().map(botRow).join("") +
      '<button type="button" class="text-btn new-bot" data-act="nav" data-to="#/bot/new">New bot</button></div>' +
      '<div class="list-block"><div class="side-label">Channels</div>' + rooms.map(roomRow).join("") + "</div></div>";
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
    // Folds start closed, as in the app.
    return Object.prototype.hasOwnProperty.call(state.openThink, m.id) && state.openThink[m.id];
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
  function handoffMessage(m) {
    if (!botBy(m.from) || !botBy(m.to)) return "";
    const id = m.from + "-" + m.to;
    const chat = chatById(id);
    const from = route.parts[0] === "chat" ? "?from=" + route.parts[1] : "";
    return '<div class="handoff-msg">' +
      '<button type="button" class="handoff" data-act="nav" data-to="#/convo/' + esc(id + from) + '">' +
      '<span class="route">' + esc(botName(m.from)) + " → " + esc(botName(m.to)) + "</span>" +
      '<span class="when">' + esc(m.time || "") + (chat && chat.paused ? " · Paused" : "") + " · Open</span></button></div>";
  }
  function roomBotMessage(m) {
    let text = m.text || "";
    if (m.to && m.to !== "you" && text.indexOf("@") !== 0) text = "@" + botName(m.to) + " " + text;
    return '<div class="msg msg-assistant">' + avatar(m.who, { sm: true }) +
      "<div><div class=\"who\">" + esc(botName(m.who)) + " <span>" + esc(m.time || "") + "</span></div>" +
      paras(text) + "</div></div>";
  }
  // The app folds a run's thinking, tool calls, and subagent work into one line between replies, labelled with what
  // is running while live, or a summary such as "Thought · ran 2 tools" once done.
  function workLabel(m) {
    const live = (m.tools || []).concat(m.subagents || []).filter(function (t) { return t.running; })[0];
    if (live) return "Running " + (live.line ? live.line.replace(/^Running:\s*/, "") : "Subagent · " + live.name);
    if (m.thinking && m.thinking.streaming) return "Thinking…";
    const count = (m.tools || []).length + (m.subagents || []).length;
    const parts = m.thinking ? ["Thought"] : [];
    if (count) parts.push("ran " + count + (count === 1 ? " tool" : " tools"));
    const label = parts.join(" · ");
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  function assistantMessage(m) {
    const hasWork = !!(m.thinking || (m.tools || []).length || (m.subagents || []).length);
    const open = hasWork && thinkOpen(m);
    let work = "";
    if (hasWork) {
      const live = (m.thinking && m.thinking.streaming) || (m.tools || []).concat(m.subagents || []).some(function (t) { return t.running; });
      work = '<button type="button" class="think" data-act="think" data-id="' + m.id + '">' + (live ? '<i class="work-dot pulse"></i>' : "") + (open ? "▾ " : "▸ ") + esc(workLabel(m)) + "</button>";
    }
    let think = "";
    if (open && m.thinking) {
      const cls = m.thinking.streaming ? "think-body caret" : "think-body";
      think = '<div class="' + cls + '">' + esc(m.thinking.text) + "</div>";
    }
    const tools = !open ? "" : (m.tools || []).map(function (t) {
      const opened = toolOpen(t.id);
      let block = '<button type="button" class="tool" data-act="tool" data-id="' + t.id + '">' +
        (t.running ? '<i class="work-dot pulse"></i>' : "") + (opened ? "▾ " : "▸ ") + esc(t.line) + "</button>";
      if (opened) {
        block += '<div class="tool-body"><div class="kv">Input</div>' + esc(t.input || "") + '<div class="kv">Output</div>' + esc(t.output || "") + "</div>";
      }
      return block;
    }).join("");
    const subs = !open ? "" : (m.subagents || []).map(function (s) {
      const opened = toolOpen(s.id);
      let block = '<button type="button" class="tool" data-act="tool" data-id="' + s.id + '">' +
        (s.running ? '<i class="work-dot pulse"></i>' : "") + (opened ? "▾ " : "▸ ") + "Subagent · " + esc(s.name) + " · " + esc(s.status) + "</button>";
      if (opened) {
        block += '<div class="tool-body"><div class="kv">Task</div>' + esc(s.task) + '<div class="kv">Work so far</div>' + esc(s.work) + "</div>";
      }
      return block;
    }).join("");
    think = work + (open ? '<div class="work-fold">' + think + tools + subs + "</div>" : "");
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
    // Tokens and cost for the whole run, once it ends, with Copy for everything the bot said.
    let usage = "";
    if (m.usage) {
      usage = '<div class="usage-line"><span>' + toks(m.usage.tokens) + " · " + money(m.usage.cost) + "</span>" +
        '<button type="button" class="text-btn" data-act="copy-msg" data-id="' + m.id + '">Copy</button></div>';
    }
    return '<div class="msg msg-assistant">' + avatar(m.who, { sm: true }) + "<div>" +
      '<div class="who">' + esc(botName(m.who)) + " <span>" + esc(m.time || "") + "</span></div>" +
      think + todos + body + diff + code + usage + "</div></div>";
  }
  function renderMessage(m, list) {
    let html;
    if (m.role === "system") html = '<div class="sys">' + esc(m.text) + "</div>";
    else if (m.role === "user") html = userMessage(m, list);
    else if (m.role === "routine") html = routineMessage(m);
    else if (m.role === "handoff") html = handoffMessage(m);
    else if (m.role === "bot") html = roomBotMessage(m);
    else html = assistantMessage(m);
    const on = state.highlight === m.id ? " flash" : "";
    return '<div class="anchor' + on + '" id="msg-' + esc(m.id) + '">' + html + "</div>";
  }

  function approvalCard() {
    if (state.approvalChoice) {
      const map = { once: "Allowed once", chat: "Allowed for this chat", deny: "Denied", auto: "Denied automatically" };
      return '<div class="card"><div class="settled">' + map[state.approvalChoice] + " · " + esc(HB.approval.title) + "</div></div>";
    }
    return '<div class="card alert"><span class="timer" id="approval-timer">Auto-denies in ' + clock(state.approvalLeft) + '</span>' +
      '<div class="kicker">Needs you</div><h3>' + esc(HB.approval.title) + "</h3><p>" + esc(HB.approval.description) + "</p>" +
      '<p class="need-k">' + esc(HB.approval.reason) + "</p>" +
      '<button type="button" class="text-btn" data-act="approval-expand">' + (state.approvalOpen ? "Hide command" : "Full command") + "</button>" +
      (state.approvalOpen ? '<pre class="cmd">' + esc(HB.approval.command) + "</pre>" : "") +
      '<div class="choices"><button type="button" class="choice primary" data-act="approve" data-id="once">Allow once</button>' +
      '<button type="button" class="choice" data-act="approve" data-id="chat">Allow for this chat</button>' +
      '<button type="button" class="choice" data-act="approve" data-id="deny">Deny</button></div></div>';
  }
  function restoreCard() {
    const target = deletedBots.filter(function (b) { return b.id === "courier"; })[0];
    if (!target) return '<div class="card"><div class="settled">Restored · Courier</div></div>';
    if (state.restoreDeclined) return '<div class="card"><div class="settled">Kept deleted · ' + esc(target.name) + "</div></div>";
    return '<div class="card alert"><div class="kicker">Needs you</div><h3>Restore ' + esc(target.name) + "?</h3>" +
      "<p>Its chat, memory, notes, and folder come back as they were. Its routines stay paused until you resume them.</p>" +
      '<p class="need-k">Deleted ' + esc(target.time) + ". Restoring needs your approval, like any change the main bot makes to another bot.</p>" +
      '<div class="choices"><button type="button" class="choice primary" data-act="restore-bot" data-id="' + target.id + '">Restore</button>' +
      '<button type="button" class="choice" data-act="restore-no">Keep deleted</button></div></div>';
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
      }).join("") + '<button type="button" class="row" data-act="nav" data-to="#/providers">Connect a provider</button></div>';
  }
  function attachRow() {
    if (!state.attachments.length) return "";
    return '<div class="attach-row">' + state.attachments.map(function (a) {
      const thumb = a.kind === "image" ? '<img alt="" src="' + a.src + '">' : "";
      return '<span class="chip">' + thumb + esc(a.name) + (a.size ? " · " + esc(a.size) : "") +
        '<button type="button" data-act="unattach" data-id="' + a.id + '" aria-label="Remove">×</button></span>';
    }).join("") + "</div>";
  }
  // Messages waiting for the running turn, shown greyed at the end of the chat as the app shows them.
  function queuedMessages(bot) {
    return (bot.queue || []).map(function (q) {
      return '<div class="msg msg-user queued"><div class="bubble">' + esc(q) + '</div><div class="msg-time">Queued</div></div>';
    }).join("");
  }
  function queueRow(bot) {
    if (!bot.queue || !bot.queue.length) return "";
    return '<div class="queue">' + bot.queue.map(function (q, i) {
      return '<span class="chip">Queued · ' + esc(q) + '<button type="button" data-act="unqueue" data-id="' + i + '" aria-label="Remove from queue">×</button></span>';
    }).join("") + "</div>";
  }
  function canSend() { return !!(state.composer.trim() || state.attachments.length); }
  function slashQuery() {
    const line = (state.composer || "").split("\n")[0];
    if (line.charAt(0) !== "/") return null;
    if (/\s/.test(line)) return null;
    return line.slice(1).toLowerCase();
  }
  function slashMatches() {
    const q = slashQuery();
    if (q === null) return [];
    return (HB.commands || []).filter(function (c) {
      return c.name.toLowerCase().indexOf(q) === 0 || (c.hint || "").toLowerCase().indexOf(q) >= 0;
    });
  }
  function slashHtml() {
    const q = slashQuery();
    if (q === null) return "";
    const list = slashMatches();
    if (!list.length) return '<div class="slash empty">No matching command</div>';
    if (state.slashIndex >= list.length) state.slashIndex = list.length - 1;
    if (state.slashIndex < 0) state.slashIndex = 0;
    return '<div class="slash" role="listbox">' + list.map(function (c, i) {
      return '<button type="button" role="option" class="' + (i === state.slashIndex ? "on" : "") + '" data-act="slash" data-id="' + esc(c.name) + '">' +
        "<b>/" + esc(c.name) + "</b><span>" + esc(c.hint) + "</span></button>";
    }).join("") + "</div>";
  }
  function paintSlash() {
    const host = document.getElementById("slash-host");
    if (host) host.innerHTML = slashHtml();
  }
  function dock(bot, room) {
    const working = bot && bot.working;
    const reply = state.replyTo ? findMessage(state.replyTo) : null;
    const replyHtml = reply ? '<div class="replychip"><span class="chip">Replying to ' + esc(reply.routine || "message") +
      '<button type="button" data-act="clear-reply" aria-label="Cancel reply">×</button></span></div>' : "";
    const eff = bot ? effective(bot) : null;
    const placeholder = room ? "Message " + room.name : (working ? "Queue a message" : "Message " + bot.name);
    const sendBtn = working
      ? '<button type="button" class="text-btn" id="queue-btn" data-act="send"' + (canSend() ? "" : " disabled") + ">Queue</button>" +
        '<button type="button" class="ghost" id="steer-btn" data-act="steer"' + (canSend() ? "" : " disabled") + ">Steer</button>" +
        '<button type="button" class="ghost" data-act="stop">' + svg(IC.square, 12) + " Stop</button>"
      : '<button type="button" class="send" id="send-btn" data-act="send"' + (canSend() ? "" : " disabled") + ' aria-label="Send">' + svg(IC.up, 18) + "</button>";
    const modelBtn = eff ? '<button type="button" class="model-chip" data-act="toggle-model">' + esc(eff.model) + " · " + esc(eff.effort) + "</button>" : "";
    // The app has one box while the bot works: Queue sends after the turn, and Steer adds the text to the turn.
    const steer = "";
    return '<div class="dock"><div class="dock-inner">' + replyHtml + attachRow() + steer +
      (state.modelOpen && bot ? modelPop(bot) : "") +
      '<div id="slash-host">' + slashHtml() + "</div>" +
      '<div class="composer-box"><textarea id="composer" rows="1" placeholder="' + esc(placeholder) + '" autocomplete="off">' + esc(state.composer) + "</textarea>" +
      '<div class="composer-tools"><button type="button" class="icon-btn" data-act="pick-file" aria-label="Attach file">' + svg(IC.clip) + "</button>" +
      '<button type="button" class="icon-btn" data-act="paste-sample" aria-label="Paste image">' + svg(IC.image) + "</button>" +
      '<button type="button" class="icon-btn slash-btn" data-act="slash-ins" aria-label="Commands">/</button>' +
      '<span class="spacer"></span>' +
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
        (state.menu ? '<div class="sheet"><button type="button" data-act="summarize" data-id="' + bot.id + '">Summarize</button>' +
          '<button type="button" data-act="nav" data-to="#/bot/' + bot.id + '">Bot info</button>' +
          '<button type="button" data-act="nav" data-to="#/memory/' + bot.id + '">Memory</button>' +
          '<button type="button" data-act="nav" data-to="#/notes/' + bot.id + '">Notes</button>' +
          '<button type="button" data-act="nav" data-to="#/routines/' + bot.id + '">Routines</button>' +
          '<button type="button" data-act="nav" data-to="#/usage">Usage</button>' +
          '<button type="button" data-act="nav" data-to="#/settings">Settings</button></div>' : "");
    }
    return '<div class="topbar-actions"><button type="button" class="text-btn" data-act="summarize" data-id="' + bot.id + '">Summarize</button>' +
      '<button type="button" class="text-btn" data-act="nav" data-to="#/bot/' + bot.id + '">Info</button></div>';
  }
  function chatColumn(botId) {
    const bot = botBy(botId) || bots[0];
    const list = currentThread(bot.id);
    const eff = effective(bot);
    const bits = [];
    if (state.view === "attach") bits.push("Attachments");
    bits.push(eff.model, eff.effort, "18.2k/200k context");
    if (eff.custom) bits.push("this chat");
    const cost = chatCost(list);
    if (cost) bits.push(money(cost) + " this chat");
    if (bot.working) bits.push("Working…");
    let cards = "";
    if (bot.id === "ledger") cards += approvalCard();
    if (bot.pinned && state.view === "restore") cards += restoreCard();
    if (bot.id === "atlas") cards += clarifyCard();
    state.proposals.filter(function (p) { return p.bot === bot.id; }).forEach(function (p) { cards += proposalCard(p); });
    return '<div class="column"><div class="topbar">' + backBtn() + avatar(bot.id) +
      '<div class="topbar-text"><strong>' + esc(bot.name) + "</strong><span>" + esc(bits.join(" · ")) + "</span></div>" +
      chatActions(bot) + "</div>" + bannerHtml() +
      '<div class="pane"><div class="thread">' + list.map(function (m) { return renderMessage(m, list); }).join("") +
      (cards ? '<div class="msg">' + cards + "</div>" : "") + queuedMessages(bot) + "</div></div>" + dock(bot, null) + "</div>";
  }
  function roomColumn(roomId) {
    const room = rooms.filter(function (r) { return r.id === roomId; })[0];
    if (!room) return column("Channel", "", '<div class="pane"><div class="empty">That channel is gone.</div></div>');
    const names = room.members.filter(botBy).map(botName).join(", ");
    const list = roomLogs[room.id] || [];
    return '<div class="column"><div class="topbar">' + backBtn() + roomAvatar() +
      '<div class="topbar-text"><strong>' + esc(room.name) + "</strong><span>" + esc(names) + "</span></div></div>" +
      '<div class="pane"><div class="thread">' + list.map(function (m) { return renderMessage(m, list); }).join("") + "</div></div>" +
      dock(null, room) + "</div>";
  }

  function routineCard(job) {
    return '<div class="r-card"><div class="bot-line"><h3>' + esc(job.name) + "</h3>" +
      (job.paused ? '<span class="paused-tag">Paused</span>' : "") +
      (job.createdBy ? '<span class="tag">Created by ' + esc(botName(job.createdBy)) + "</span>" : "") + "</div>" +
      '<div class="meta">' + esc(schedLabel(job)) + "<br>" + esc(deliverLabel(job)) + " · Memory " + (job.memory ? "on" : "off") + "</div>" +
      '<div class="r-actions">' +
      '<button type="button" class="ghost" data-act="pause" data-id="' + job.id + '">' + (job.paused ? "Resume" : "Pause") + "</button>" +
      '<button type="button" class="ghost" data-act="run-now" data-id="' + job.id + '">Run now</button>' +
      '<button type="button" class="ghost" data-act="nav" data-to="#/routine/edit/' + job.id + '">Edit</button>' +
      '<button type="button" class="ghost" data-act="nav" data-to="#/routine/runs/' + job.id + '">History</button></div></div>';
  }
  function routinesView(botId) {
    const toast = state.toast ? '<div class="toast" id="toast">' + esc(state.toast.text) +
      ' <button type="button" class="text-btn" data-act="open-run" data-bot="' + state.toast.bot + '" data-msg="' + state.toast.msg + '">Open chat</button></div>' : "";
    let body;
    if (botId) {
      const mine = routines.filter(function (r) { return r.bot === botId; });
      body = '<div class="pane"><div class="page">' + toast +
        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><h2>' + esc(botName(botId)) + '</h2>' +
        '<button type="button" class="primary" data-act="nav" data-to="#/routine/new?bot=' + botId + '">New routine</button></div>' +
        '<p class="lede">Results post into this bot\'s chat.</p>' +
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
      '<p class="lede">Every bot. A run posts into that bot\'s chat, and can also raise an alert.</p>' +
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
      '<button type="button" class="check" data-act="deliver" data-id="ntfy"><span class="toggle' + (f.ntfy ? " on" : "") + '"><i></i></span> Alert</button></div>' +
      '<p class="need-k">An alert is a Botsman notification. On the phone it comes from the app\'s own background connection. On Windows it is a tray notification.</p></div>' +
      '<div class="field"><div class="lbl">Memory</div><button type="button" class="check" data-act="form-memory"><span class="toggle' + (f.memory ? " on" : "") + '"><i></i></span> Load the memory files</button>' +
      '<p class="need-k">Off means this routine runs with its instructions only. On loads USER_PROFILE.md, USER_MEMORY.md, BOT_PROFILE.md, and BOT_MEMORY.md.</p></div>' +
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
      const open = r.msg
        ? '<button type="button" class="text-btn" data-act="open-run" data-bot="' + job.bot + '" data-msg="' + esc(r.msg) + '">Open in chat</button>'
        : "";
      return '<div class="set-row"><div><b>' + esc(r.status) + "</b> · " + esc(r.when) + '<div class="sub">' + esc(r.detail) + "</div></div>" + open + "</div>";
    }).join("") : '<p class="lede">No runs yet.</p>';
    return column(job.name, schedLabel(job), '<div class="pane"><div class="page"><p class="lede">Every run posts into this bot\'s chat. Open jumps to that message.</p>' + rows + "</div></div>");
  }

  function usageRows() {
    const live = HB.usageByBot.filter(function (p) { return botBy(p[0]); }).map(function (p) { return [botName(p[0]), p[1]]; });
    const gone = HB.usageByBot.filter(function (p) { return !botBy(p[0]); }).reduce(function (sum, p) { return sum + p[1]; }, 0);
    return gone ? live.concat([["Deleted bots", gone]]) : live;
  }
  function usageView() {
    const max = Math.max.apply(null, HB.usageDays);
    const rows = usageRows();
    const maxBot = Math.max.apply(null, rows.map(function (x) { return x[1]; }));
    const bars = HB.usageDays.map(function (v) {
      return '<i class="bar" style="height:' + Math.max(4, Math.round(v / max * 100)) + '%"></i>';
    }).join("");
    const byBot = rows.map(function (pair) {
      return '<div class="u-row"><div>' + esc(pair[0]) + '<div class="meter"><i style="width:' + Math.round(pair[1] / maxBot * 100) + '%"></i></div></div><span>' + money(pair[1]) + "</span></div>";
    }).join("");
    const body = '<div class="pane"><div class="page"><h2>October</h2><p class="lede">$18.40 across the last 14 days, ending 27 Oct.</p>' +
      '<div class="bars">' + bars + '</div><div class="bar-labels"><span>14 Oct</span><span>27 Oct</span></div>' +
      '<div class="group-label">By bot</div>' + byBot +
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
    const links = [
      ["Memory", "#/memory/" + bot.id, "The four files this bot loads"],
      ["Notes", "#/notes/" + bot.id, notesFor(bot.id).length + " notes"],
      ["Bot settings", "#/bot-settings/" + bot.id, "Permissions, network, connections, skills"],
      ["Routines", "#/routines/" + bot.id, "Scheduled runs"]
    ].map(function (l) {
      return '<button type="button" class="set-row wide" data-act="nav" data-to="' + l[1] + '"><span><b>' + esc(l[0]) + '</b><span class="sub block">' + esc(l[2]) + "</span></span><span>›</span></button>";
    }).join("");
    const remove = bot.pinned ? '<p class="need-k">The main bot cannot be deleted.</p>' :
      (state.confirmDelete === "bot:" + bot.id
        ? '<span class="confirm">Delete ' + esc(bot.name) + '? It leaves the apps, and its data stays on the server. The main bot can restore it.<button type="button" class="text-btn" data-act="delete-bot" data-id="' + bot.id + '">Delete</button><button type="button" class="text-btn" data-act="delete-no">Cancel</button></span>'
        : '<button type="button" class="ghost" data-act="delete-ask" data-id="bot:' + bot.id + '">Delete bot</button>');
    const body = '<div class="pane"><div class="page"><div class="hero">' + avatar(bot.id, { lg: true }) +
      '<button type="button" class="primary" data-act="pick-avatar">Upload a photo</button>' +
      '<button type="button" class="text-btn">Use the initial</button>' +
      '<input id="avatar-in" type="file" accept="image/*" hidden></div>' +
      '<div class="lbl">Or choose</div><div class="marks">' + marks + "</div>" +
      '<div class="field"><label for="bot-name">Name</label><input id="bot-name" data-field="bot:name" value="' + esc(bot.name) + '"></div>' +
      '<div class="field"><label for="bot-desc">Description</label><input id="bot-desc" data-field="bot:description" value="' + esc(bot.description) + '"></div>' +
      '<button type="button" class="set-row wide" data-act="toggle-model"><span><b>Model default</b><span class="sub block">' + esc(bot.model) + " · " + esc(bot.effort) + " · used by chats that haven't picked their own</span></span><span>›</span></button>" +
      links + '<div style="margin-top:12px">' + remove + "</div></div></div>";
    return column(bot.name, "Bot info", body);
  }
  function settingsView() {
    const theme = localStorage.getItem("hb-theme") || "system";
    const providerCount = state.providers.length;
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
    const body = '<div class="pane"><div class="page"><h2>Servers</h2><p class="lede">Any HTTPS address. Switching signs you in again. The username stays filled in.</p>' + rows +
      '<div class="group-label">Add a server</div>' +
      '<div class="field"><label for="sv-name">Name</label><input id="sv-name" data-field="add:name" value="' + esc(add.name) + '" placeholder="studio"></div>' +
      '<div class="field"><label for="sv-host">Address</label><input id="sv-host" data-field="add:host" value="' + esc(add.host) + '" placeholder="bots.example.com" spellcheck="false"></div>' +
      '<div class="field"><label for="sv-port">Port</label><input id="sv-port" data-field="add:port" value="' + esc(add.port) + '" inputmode="numeric"></div>' +
      (add.error ? '<div class="err">' + esc(add.error) + "</div>" : "") +
      '<button type="button" class="primary" data-act="add-server">Add server</button>' +
      alertsSection() + backgroundSection() + devicesSection() +
      '<div class="group-label">Mode</div><div class="seg" style="margin-bottom:12px">' + seg + "</div>" +
      '<div class="set-row"><div><b>Model providers</b><div class="sub">' + providerCount + ' connected</div></div><button type="button" class="text-btn" data-act="nav" data-to="#/providers">Open</button></div>' +
      '<div class="group-label">This app</div>' +
      '<div class="set-row"><div><b>Botsman ' + esc(version()) + '</b><div class="sub">' + (state.installed ? "Up to date, checked at 9:52 PM" : "Version " + HB.nextVersion + " is available") + "</div></div>" +
      (state.installed ? '<button type="button" class="ghost">Check for updates</button>' : '<button type="button" class="primary" data-act="nav" data-to="#/update">Install</button>') + "</div>" +
      "</div></div>";
    return column("Settings", currentServer().name, body);
  }
  // Settings as the app draws it: alert switches that apply to every device, the background connection, and the
  // devices signed in to this server.
  function alertsSection() {
    const kinds = [["approval", "Approvals", "A bot asks before an action or a memory edit"], ["errors", "Failures", "A reply stops with an error"]];
    return '<div class="group-label">Alerts</div><p class="need-k">These apply to every device signed in to this server.</p>' + kinds.map(function (k) {
      const on = state.notif[k[0]] !== false;
      return '<button type="button" class="set-row wide" data-act="notif" data-id="' + k[0] + '"><span><b>' + k[1] + '</b><span class="sub block">' + k[2] + '</span></span><span class="toggle' + (on ? " on" : "") + '"><i></i></span></button>';
    }).join("");
  }
  function backgroundSection() {
    if (device() === "phone") {
      return '<div class="group-label">Alerts when the app is closed</div>' +
        '<button type="button" class="set-row wide"><span><b>Keep connected</b><span class="sub block">Botsman keeps its own connection to your server and posts alerts itself.</span></span><span class="toggle on"><i></i></span></button>' +
        '<p class="need-k">Connected. An ongoing notification shows while it runs.</p>' +
        '<div class="set-row"><div><b>Notifications</b><div class="sub">Allowed</div></div><span class="tag">Done</span></div>' +
        '<div class="set-row"><div><b>Battery</b><div class="sub">Android may pause the connection to save battery</div></div><button type="button" class="ghost">Open</button></div>' +
        '<div class="set-row"><div><b>Phone maker</b><div class="sub">Samsung can stop background apps. Its steps are on dontkillmyapp.com.</div></div><button type="button" class="ghost">Guide</button></div>';
    }
    return '<div class="group-label">Alerts when the window is closed</div>' +
      '<button type="button" class="set-row wide"><span><b>Keep connected</b><span class="sub block">Botsman stays in the tray, keeps its connection to your server, and posts its own notifications.</span></span><span class="toggle on"><i></i></span></button>' +
      '<button type="button" class="set-row wide"><span><b>Start with Windows</b><span class="sub block">Opens hidden in the tray when you sign in to Windows.</span></span><span class="toggle on"><i></i></span></button>';
  }
  function devicesSection() {
    const devices = [["Windows app", "This device", false], ["Pixel 8, Android 16", "Last used 9:40 PM", true], ["Web dashboard", "Yesterday", true]];
    return '<div class="group-label">Signed-in devices</div>' + devices.map(function (d) {
      return '<div class="set-row"><div><b>' + esc(d[0]) + '</b><div class="sub">' + esc(d[1]) + "</div></div>" + (d[2] ? '<button type="button" class="ghost">Sign out</button>' : "") + "</div>";
    }).join("");
  }
  function notifView() {
    const phone = device() === "phone";
    const toggles = HB.notifications.map(function (n) {
      const on = !!state.notif[n.id];
      return '<button type="button" class="set-row" data-act="notif" data-id="' + n.id + '"><span>' + esc(n.label) + '</span><span class="toggle' + (on ? " on" : "") + '"><i></i></span></button>';
    }).join("");
    const sample = '<button type="button" class="note-card" data-act="open-run" data-bot="junior" data-msg="j-brief"><b>Botsman</b>Junior has a new routine result<span>' +
      (phone ? "Tap opens Junior's chat" : "Tray notification · opens Junior's chat") + "</span></button>";
    const body = '<div class="pane"><div class="page">' + (phone ? phonePush() : desktopPush()) + sample + toggles + "</div></div>";
    return column("Notifications", phone ? "Background connection" : "Windows tray", body);
  }
  function desktopPush() {
    return "<h2>Tray</h2><p class=\"lede\">Botsman stays in the tray, keeps its connection to the server, and posts its own notifications. A click opens the chat.</p>" +
      '<div class="set-row"><div><b>Status</b><div class="sub">Windows tray · connected to ' + esc(currentServer().name) + "</div></div></div>";
  }
  function phonePush() {
    return '<h2>Alerts when the app is closed</h2>' +
      '<p class="lede">Botsman keeps its own connection to ' + esc(currentServer().name) + " and posts notifications itself. Android requires an ongoing notification while it runs. You can silence it in Android settings.</p>" +
      '<div class="set-row"><div><b>Status</b><div class="sub">Connected to ' + esc(currentServer().name) + " · ongoing notification shown</div></div></div>" +
      '<div class="set-row"><div><b>Battery</b><div class="sub">Unrestricted</div></div><span class="tag">Done</span></div>' +
      '<div class="set-row"><div><b>Phone maker</b><div class="sub">Samsung can stop background apps. See its guide on dontkillmyapp.com</div></div><button type="button" class="text-btn">Guide</button></div>';
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
    return '<div class="login"><div class="login-card"><div class="wordmark" style="margin-bottom:18px">Botsman</div>' +
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

  function fileText(botId, file) {
    if (file === "USER_PROFILE" || file === "USER_MEMORY") return files.user[file];
    if (!files.bots[botId]) files.bots[botId] = { BOT_PROFILE: (botBy(botId) || {}).about || "", BOT_MEMORY: "" };
    return files.bots[botId][file];
  }
  function setFileText(botId, file, text) {
    if (file === "USER_PROFILE" || file === "USER_MEMORY") files.user[file] = text;
    else {
      fileText(botId, file);
      files.bots[botId][file] = text;
    }
  }
  function proposalCard(p) {
    return '<div class="card alert"><div class="kicker">Needs you · Memory edit</div><h3>' + esc(botName(p.bot)) + " wants to change " + esc(p.file) + ".md</h3>" +
      '<div class="diff"><div class="diff-line add">+ ' + esc(p.add) + "</div></div>" +
      '<p class="need-k">From: ' + esc(p.source) + ". " + esc(botName(p.bot)) + " keeps working while this waits.</p>" +
      '<div class="choices"><button type="button" class="choice primary" data-act="proposal-yes" data-id="' + p.id + '">Confirm</button>' +
      '<button type="button" class="choice" data-act="proposal-no" data-id="' + p.id + '">Reject</button></div></div>';
  }
  function settleProposal(id, accept) {
    const p = state.proposals.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    if (accept) {
      const text = fileText(p.bot, p.file);
      setFileText(p.bot, p.file, (text ? text + "\n" : "") + "- " + p.add);
    }
    state.proposals = state.proposals.filter(function (x) { return x.id !== id; });
    render({ preserve: true });
  }
  function memoryView(botId) {
    const bot = botBy(botId) || bots[0];
    const file = state.memFile[bot.id] || "BOT_PROFILE";
    const text = fileText(bot.id, file);
    const pending = state.proposals.filter(function (p) { return p.bot === bot.id; }).map(proposalCard).join("");
    const tabs = ["USER_PROFILE", "USER_MEMORY", "BOT_PROFILE", "BOT_MEMORY"].map(function (k) {
      return '<button type="button" class="' + (k === file ? "on" : "") + '" data-act="mem-file" data-bot="' + bot.id + '" data-id="' + k + '">' + k + ".md</button>";
    }).join("");
    const level = file === "USER_PROFILE" || file === "USER_MEMORY" ? "Shared by every bot" : "Only " + bot.name;
    const body = '<div class="pane"><div class="page">' + pending +
      '<div class="seg" style="margin-bottom:12px">' + tabs + "</div>" +
      '<p class="lede">' + esc(FILE_INFO[file]) + "</p>" +
      '<div class="field"><label for="mem-text">' + esc(file) + ".md · " + esc(level) + "</label>" + (state.memEditing === bot.id + ":" + file
        ? '<textarea id="mem-text" class="file-text" rows="11" data-field="mem:' + bot.id + ":" + file + '">' + esc(text) + "</textarea>"
        : '<div class="read-only">' + (text.trim() ? paras(text) : '<span class="need-k">Empty</span>') + "</div>") +
      '<div class="count" id="mem-count">' + text.length.toLocaleString("en-US") + " / " + LIMITS[file].toLocaleString("en-US") + " characters</div></div>" +
      (state.memError ? '<div class="err">' + esc(state.memError) + "</div>" : "") +
      (state.memSaved ? '<p class="need-k">Saved. Each bot gets the change with its next message.</p>' : "") +
      (state.memEditing === bot.id + ":" + file
        ? '<div class="choices"><button type="button" class="primary" data-act="mem-save" data-bot="' + bot.id + '" data-id="' + file + '">Save</button><button type="button" class="text-btn" data-act="mem-cancel">Cancel</button></div>'
        : '<div class="choices"><button type="button" class="ghost" data-act="mem-edit" data-bot="' + bot.id + '" data-id="' + file + '">Edit</button></div>') +
      "</div></div>";
    return column("Memory", bot.name, body);
  }
  function notesFor(botId) {
    if (!notes[botId]) notes[botId] = [];
    return notes[botId];
  }
  function noteRows(botId) {
    const q = state.noteQuery.trim().toLowerCase();
    const list = notesFor(botId).filter(function (n) {
      return !q || n.name.toLowerCase().indexOf(q) >= 0 || n.text.toLowerCase().indexOf(q) >= 0;
    });
    if (!list.length) return '<div class="empty">' + (q ? "No note matches that." : "No notes yet.") + "</div>";
    return list.map(function (n) {
      return '<button type="button" class="set-row wide" data-act="nav" data-to="#/notes/' + botId + "/" + n.id + '"><span><b>' + esc(n.name) + '</b><span class="sub block">' + esc(snippet(n.text) || "Empty") + '</span></span><span class="tag">' + esc(n.updated) + "</span></button>";
    }).join("");
  }
  function notesView(botId) {
    const bot = botBy(botId) || bots[0];
    const body = '<div class="pane"><div class="page">' +
      '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><h2>Notes</h2>' +
      '<button type="button" class="primary" data-act="note-new" data-bot="' + bot.id + '">New note</button></div>' +
      '<p class="lede">Longer records this bot keeps, such as the projects it tracks. A bot opens a note only when it needs it, and its edits here do not ask you.</p>' +
      '<div class="field"><label for="note-q">Search</label><input id="note-q" data-field="note-q:' + bot.id + '" value="' + esc(state.noteQuery) + '" placeholder="Search by keyword"></div>' +
      '<div id="note-rows">' + noteRows(bot.id) + "</div></div></div>";
    return column("Notes", bot.name, body);
  }
  function noteView(botId, noteId) {
    const bot = botBy(botId) || bots[0];
    const note = notesFor(bot.id).filter(function (n) { return n.id === noteId; })[0];
    if (!note) return column("Note", bot.name, '<div class="pane"><div class="empty">That note is gone.</div></div>');
    const remove = state.confirmDelete === "note:" + note.id
      ? '<span class="confirm">Delete this note?<button type="button" class="text-btn" data-act="delete-note" data-bot="' + bot.id + '" data-id="' + note.id + '">Delete</button><button type="button" class="text-btn" data-act="delete-no">Cancel</button></span>'
      : '<button type="button" class="ghost" data-act="delete-ask" data-id="note:' + note.id + '">Delete</button>';
    // A note opens read-only, as in the app. Edit turns it into the form; a new note opens ready to write.
    const editing = state.noteEditing === note.id;
    const body = editing
      ? '<div class="pane"><div class="page">' +
        '<div class="field"><label for="note-name">File name</label><input id="note-name" data-field="note:' + bot.id + ":" + note.id + ':name" value="' + esc(note.name) + '" spellcheck="false"></div>' +
        '<div class="field"><label for="note-text">Text</label><textarea id="note-text" class="file-text" rows="13" data-field="note:' + bot.id + ":" + note.id + ':text">' + esc(note.text) + "</textarea></div>" +
        '<div class="choices"><button type="button" class="primary" data-act="note-save">Save</button></div></div></div>'
      : '<div class="pane"><div class="page"><div class="read-only">' + (note.text.trim() ? paras(note.text) : '<span class="need-k">Empty</span>') + "</div>" +
        (state.noteSaved ? '<p class="need-k">Saved.</p>' : "") +
        '<div class="choices"><button type="button" class="ghost" data-act="note-edit" data-id="' + note.id + '">Edit</button>' + remove + "</div></div></div>";
    return column(note.name, bot.name + " · Notes", body);
  }
  function cfgFor(botId) {
    if (!state.botCfg[botId]) {
      const seed = HB.botCfg[botId] || {};
      state.botCfg[botId] = {
        mode: seed.mode || "manual", wait: seed.wait || "1 hour", network: seed.network !== false, hostShell: false,
        mcp: Object.assign({}, seed.mcp), skills: Object.assign({}, seed.skills)
      };
    }
    return state.botCfg[botId];
  }
  function toggleRow(act, botId, id, on, label, sub) {
    return '<button type="button" class="set-row wide" data-act="' + act + '" data-bot="' + botId + '" data-id="' + esc(id) + '"><span><b>' + esc(label) + '</b><span class="sub block">' + esc(sub) + '</span></span><span class="toggle' + (on ? " on" : "") + '"><i></i></span></button>';
  }
  function modeNote(mode) {
    if (mode === "smart") return "A classifier decides anything that leaves this bot's folder. If it is unsure or fails, it asks you.";
    if (mode === "off") return "Actions outside this bot's folder run without asking.";
    return "Anything that leaves this bot's folder asks you.";
  }
  function hostShellRow(act, botId, on) {
    return toggleRow(act, botId, "host-shell", on, "Server shell", "Lets the main bot run commands on your server, outside its sandbox, with your full access. It follows the approval mode. Off by default.");
  }
  function mcpManager() {
    const a = state.addMcp;
    return '<div class="group-label">Add a connection</div><p class="need-k">Only the main bot manages connections. Each bot then turns them on or off for itself.</p>' +
      '<div class="field"><label for="mcp-name">Name</label><input id="mcp-name" data-field="mcp:name" value="' + esc(a.name) + '" placeholder="calendar"></div>' +
      '<div class="field"><label for="mcp-url">Address</label><input id="mcp-url" data-field="mcp:url" value="' + esc(a.url) + '" placeholder="https://mcp.example.com" spellcheck="false"></div>' +
      (a.error ? '<div class="err">' + esc(a.error) + "</div>" : "") +
      '<button type="button" class="primary" data-act="mcp-add">Add connection</button>';
  }
  function botSettingsView(botId) {
    const bot = botBy(botId) || bots[0];
    const cfg = cfgFor(bot.id);
    const modes = [["manual", "Manual"], ["smart", "Smart"], ["off", "Off"]].map(function (m) {
      return '<button type="button" class="' + (cfg.mode === m[0] ? "on" : "") + '" data-act="cfg-mode" data-bot="' + bot.id + '" data-id="' + m[0] + '">' + m[1] + "</button>";
    }).join("");
    const waits = ["15 minutes", "1 hour", "8 hours", "1 day", "7 days"].map(function (w) {
      return "<option" + (cfg.wait === w ? " selected" : "") + ">" + esc(w) + "</option>";
    }).join("");
    const mcp = HB.mcp.map(function (c) { return toggleRow("cfg-mcp", bot.id, c.id, !!cfg.mcp[c.id], c.name, c.detail); }).join("");
    const own = (HB.botSkills[bot.id] || []).map(function (s) {
      return '<div class="static-row"><b>' + esc(s.name) + "</b><span>Always on. Created by " + esc(bot.name) + ".</span></div>";
    }).join("");
    const skillRows = function (source) {
      return HB.skills.filter(function (s) { return s.source === source; }).map(function (s) {
        return toggleRow("cfg-skill", bot.id, s.id, !!cfg.skills[s.id], s.name, s.detail);
      }).join("");
    };
    const body = '<div class="pane"><div class="page"><h2>Permissions</h2>' +
      '<div class="seg" style="margin-bottom:8px">' + modes + "</div>" +
      '<p class="lede">' + esc(modeNote(cfg.mode)) + " Memory edits always ask, in every mode.</p>" +
      '<div class="field"><label for="cfg-wait">Approval wait</label><select id="cfg-wait" data-field="cfg-wait:' + bot.id + '">' + waits + '</select><div class="need-k" style="margin-top:6px">If you do not answer in time, the action is refused and the bot is told.</div></div>' +
      toggleRow("cfg-network", bot.id, "network", cfg.network, "Network", "Commands run by this bot can reach the internet") +
      (bot.pinned ? hostShellRow("cfg-host-shell", bot.id, cfg.hostShell) : "") +
      '<div class="group-label">Connections</div>' + mcp + (bot.pinned ? mcpManager() : "") +
      (own ? '<div class="group-label">This bot\'s skills</div>' + own : "") +
      '<div class="group-label">Botsman skills</div>' + skillRows("botsman") +
      '<div class="group-label">Server skills</div>' + skillRows("server") +
      '<p class="need-k" style="margin-top:8px">Botsman and server skills start off. Turn on what this bot needs. A bot can create its own skills and routines, and you get an alert when it does. Only the main bot adds to the Botsman skills.</p>' +
      "</div></div>";
    return column("Bot settings", bot.name, body);
  }
  function chatById(id) {
    return botChats.filter(function (c) { return c.id === id && botBy(c.a) && botBy(c.b); })[0] || null;
  }
  function convoView(id) {
    const chat = chatById(id);
    if (!chat) return column("Bot chat", "", '<div class="pane"><div class="empty">That conversation is gone.</div></div>');
    const paused = chat.paused
      ? '<div class="banner" role="status"><span><strong>Paused</strong><span class="sub">10 messages without you</span></span><button type="button" class="text-btn" data-act="convo-resume" data-id="' + chat.id + '">Resume</button></div>'
      : "";
    const foot = state.stepIn[chat.id]
      ? '<div class="dock"><div class="dock-inner"><div class="steer-row"><input id="step-text" data-field="step-text" placeholder="Message both bots" value="' + esc(state.stepText) + '"><button type="button" class="ghost" data-act="step-send" data-id="' + chat.id + '">Send</button></div></div></div>'
      : '<div class="dock"><div class="dock-inner"><button type="button" class="ghost" data-act="step-in" data-id="' + chat.id + '">Step in</button></div></div>';
    return '<div class="column"><div class="topbar">' + backBtn() + avatar(chat.a, { sm: true }) + avatar(chat.b, { sm: true }) +
      '<div class="topbar-text"><strong>' + esc(botName(chat.a)) + " ↔ " + esc(botName(chat.b)) + "</strong><span>" + esc(chat.topic) + "</span></div></div>" + paused +
      '<div class="pane"><div class="thread">' + chat.messages.map(function (m) { return renderMessage(m, chat.messages); }).join("") + "</div></div>" + foot + "</div>";
  }
  function authMethod(c) {
    const methods = HB.providerAuth[c.provider];
    return methods.indexOf(c.method) >= 0 ? c.method : methods[0];
  }
  function authError(c) {
    const method = authMethod(c);
    if (method === "key" && !c.key.trim()) return "Paste a key.";
    if (method === "signin" && !c.callback.trim()) return "Paste the address or code from your browser.";
    return "";
  }
  function usageLabelField(c, head) {
    const options = ["Default", "Botsman"].map(function (label) {
      return '<button type="button" class="' + (label === c.usageLabel ? "on" : "") + '" data-act="usage-label" data-head="' + head + '" data-id="' + label + '">' + label + "</button>";
    }).join("");
    return '<div class="field"><label>Usage label</label><div class="seg">' + options + "</div>" +
      '<p class="need-k">The label Anthropic sees on requests. Default is the Agent SDK\'s own. Anthropic doesn\'t document changing it, so Botsman may affect your account. Applies the next time Claude Code starts.</p></div>';
  }
  function authBody(c, head) {
    const method = authMethod(c);
    if (method === "claude") {
      return '<p class="need-k">If Claude Code is already signed in on your server, Check login finds it. Otherwise, run this in a terminal there. The login stays with Claude Code, and Botsman never sees it.</p>' +
        '<pre class="cmd">claude auth login</pre>' +
        '<div class="field"><label for="' + head + '-program">Claude Code program (optional)</label><input id="' + head + '-program" data-field="' + head + ':claudePath" value="' + esc(c.claudePath) + '" placeholder="Included with Botsman" spellcheck="false"></div>' +
        '<div class="field"><label for="' + head + '-folder">Login folder (optional)</label><input id="' + head + '-folder" data-field="' + head + ':claudeDir" value="' + esc(c.claudeDir) + '" placeholder="~/.claude" spellcheck="false"></div>' +
        usageLabelField(c, head);
    }
    if (method === "key") {
      return '<div class="field"><label for="' + head + '-key">API key</label><input id="' + head + '-key" type="password" data-field="' + head + ':key" value="' + esc(c.key) + '" autocomplete="off" spellcheck="false"></div>';
    }
    if (method === "signin") {
      return '<p class="need-k">Sign in on the page that opens. Your browser then shows a code, or fails to load a local address, which is expected. Copy it and paste it here.</p>' +
        '<button type="button" class="ghost" data-act="auth-open">Open sign-in page</button>' +
        '<div class="field" style="margin-top:10px"><label for="' + head + '-callback">Address or code from your browser</label><input id="' + head + '-callback" data-field="' + head + ':callback" value="' + esc(c.callback) + '" placeholder="http://localhost:1455/auth/callback?code=…" spellcheck="false"></div>';
    }
    return '<p class="need-k">Open the GitHub page and enter this code, then finish here.</p>' +
      '<div class="static-row"><b>Code</b><span>4F2A-91BC</span></div>' +
      '<button type="button" class="ghost" data-act="auth-open">Open github.com/login/device</button>';
  }
  function authFields(c, head) {
    const methods = HB.providerAuth[c.provider];
    const method = authMethod(c);
    const seg = methods.length < 2 ? "" : '<div class="seg" style="margin-bottom:10px">' + methods.map(function (m) {
      return '<button type="button" class="' + (m === method ? "on" : "") + '" data-act="auth-method" data-head="' + head + '" data-id="' + m + '">' + (HB.authLabels[m] || "Sign in") + "</button>";
    }).join("") + "</div>";
    const note = method === "claude" && HB.providerNotes[c.provider] ? '<p class="need-k">' + esc(HB.providerNotes[c.provider]) + "</p>" : "";
    return seg + authBody(c, head) + note;
  }
  function providerOpen() { return state.addKey.open || route.q.get("connect"); }
  function closeConnect() {
    Object.assign(state.addKey, { open: null, key: "", callback: "", error: "" });
    if (route.q.get("connect")) location.hash = "#/providers"; else render({ preserve: true });
  }
  function providerStatus(name) {
    const p = state.providers.filter(function (x) { return x.name === name; })[0];
    if (p) return (HB.authStatus[p.auth] || "Signed in · ") + p.saved;
    const m = HB.providerAuth[name];
    return "Not connected · " + (m.length > 1 ? "API key or sign-in" : m[0] === "key" ? "API key" : "Sign-in");
  }
  function providerForm(name) {
    const a = state.addKey;
    a.provider = name;
    const label = HB.authActions[authMethod(a)] || "Finish sign-in";
    return '<div class="card" style="margin:8px 0 12px">' + authFields(a, "key") +
      (a.error ? '<div class="err">' + esc(a.error) + "</div>" : "") +
      '<div class="choices" style="margin-top:10px"><button type="button" class="primary" data-act="provider-add">' + label + '</button><button type="button" class="ghost" data-act="provider-cancel">Cancel</button></div></div>';
  }
  function providerActions(name) {
    const connected = state.providers.some(function (p) { return p.name === name; });
    if (state.confirmDelete === "provider:" + name) {
      return '<span class="confirm">Remove?<button type="button" class="text-btn" data-act="provider-remove" data-id="' + esc(name) + '">Remove</button><button type="button" class="text-btn" data-act="delete-no">Cancel</button></span>';
    }
    const open = '<button type="button" class="ghost" data-act="provider-open" data-id="' + esc(name) + '">' + (connected ? "Replace" : "Connect") + "</button>";
    return connected ? '<span class="choices">' + open + '<button type="button" class="ghost" data-act="delete-ask" data-id="provider:' + esc(name) + '">Remove</button></span>' : open;
  }
  function providersView() {
    const open = providerOpen();
    const rows = HB.providerNames.map(function (name) {
      return '<div class="set-row"><div><b>' + esc(name) + '</b><div class="sub">' + providerStatus(name) + "</div></div>" + providerActions(name) + "</div>" + (open === name ? providerForm(name) : "");
    }).join("");
    const body = '<div class="pane"><div class="page"><h2>Model providers</h2>' +
      '<p class="lede">Connect a provider with an API key, or sign in where that is available. Keys and sign-ins are stored only on the server, encrypted. Nobody can view them after saving, and bots cannot read them.</p>' + rows + "</div></div>";
    return column("Model providers", currentServer().name, body);
  }
  function newBotView() {
    const f = state.newBot;
    const options = HB.models.map(function (m) { return "<option" + (m === f.model ? " selected" : "") + ">" + esc(m) + "</option>"; }).join("");
    const body = '<div class="pane"><div class="page"><h2>New bot</h2>' +
      '<p class="lede">The bot gets its own folder, its own files, and its own chat. It starts with Manual permissions.</p>' +
      '<div class="field"><label for="nb-name">Name</label><input id="nb-name" data-field="new:name" value="' + esc(f.name) + '"></div>' +
      '<div class="field"><label for="nb-desc">Description</label><input id="nb-desc" data-field="new:description" value="' + esc(f.description) + '" placeholder="Shown in the bot list"></div>' +
      '<div class="field"><label for="nb-purpose">Purpose</label><textarea id="nb-purpose" rows="6" data-field="new:purpose" placeholder="What this bot is for. Saved as BOT_PROFILE.md.">' + esc(f.purpose) + "</textarea></div>" +
      '<div class="field"><label for="nb-model">Default model</label><select id="nb-model" data-field="new:model">' + options + "</select></div>" +
      '<div class="field"><label for="nb-folder">Folder on the server</label><input id="nb-folder" data-field="new:folder" value="' + esc(f.folder) + '" placeholder="~/.botsman/workspaces/&lt;id&gt;" spellcheck="false">' +
      '<p class="need-k">Leave it empty to use this default. The bot can read and write everything in this folder.<br>Free space: ' + HB.serverDisks.map(function (d) { return esc(d.path) + " " + esc(d.free); }).join(" · ") + "</p></div>" +
      (f.error ? '<div class="err">' + esc(f.error) + "</div>" : "") +
      '<button type="button" class="primary" data-act="bot-create">Create bot</button></div></div>';
    return column("New bot", currentServer().name, body);
  }
  function folderRefused(path) {
    if (!path) return false;
    const clean = path.replace(/\/+$/, "").replace(/^\/home\/[^/]+/, "~");
    if (clean === "" || clean === "~") return true;
    const workspace = clean.match(/^~\/\.botsman\/workspaces\/([^/]+)$/);
    if (workspace) return !!botBy(workspace[1]);
    return /^~\/(\.ssh|\.claude|\.agents|\.botsman)(\/|$)/.test(clean);
  }
  function createBot() {
    const f = state.newBot;
    if (!f.name.trim()) { f.error = "Name the bot."; render({ preserve: true }); return; }
    if (folderRefused(f.folder.trim())) { f.error = "Choose another folder. This one would expose your home folder, sensitive files, Botsman's data, or another bot."; render({ preserve: true }); return; }
    const id = uid();
    bots.push({
      id: id, name: f.name.trim(), description: f.description.trim() || "New bot", about: f.purpose,
      model: f.model, effort: "Medium", mark: "diamond", pinned: false, activity: 2000, time: "Now",
      preview: "", unread: 0, working: false, needs: null, queue: []
    });
    files.bots[id] = { BOT_PROFILE: f.purpose, BOT_MEMORY: "" };
    state.newBot = { name: "", description: "", purpose: "", model: HB.models[1], folder: "", error: "" };
    location.hash = "#/chat/" + id;
  }
  // First run as the app does it: the server's address, then the owner password and the main bot's name, which
  // create both together, then a model provider, which can wait.
  function setupFields(s) {
    if (s.step === 0) {
      return "<h1>Connect to your server</h1><p class=\"lede\">Enter the address of your Botsman server. It must use HTTPS.</p>" +
        '<div class="field"><label for="su-url">Server address</label><input id="su-url" data-field="setup:url" value="' + esc(s.url) + '" placeholder="https://bots.example.com" spellcheck="false"></div>';
    }
    if (s.step === 1) {
      return "<h1>Set up your server</h1><p class=\"lede\">Step 1 of 2. This first sign-in sets the owner password and creates your main bot. The main bot can change your other bots, and it cannot be deleted.</p>" +
        '<div class="field"><label for="su-pass">Owner password</label><input id="su-pass" type="password" data-field="setup:password" value="' + esc(s.password) + '" autocomplete="new-password"></div>' +
        '<div class="field"><label for="su-main">Main bot\'s name</label><input id="su-main" data-field="setup:main" value="' + esc(s.main) + '" placeholder="Junior"></div>';
    }
    const options = HB.providerNames.map(function (n) { return "<option" + (n === s.provider ? " selected" : "") + ">" + esc(n) + "</option>"; }).join("");
    return "<h1>Add a model provider</h1><p class=\"lede\">Step 2 of 2. Bots need one provider to run. Its key or sign-in is stored only on the server, and it can't be viewed after saving.</p>" +
      '<div class="field"><label for="su-provider">Provider</label><select id="su-provider" data-field="setup:provider">' + options + "</select></div>" + authFields(s, "setup") +
      '<button type="button" class="text-btn" data-act="setup-skip">Skip for now</button>';
  }
  function setupNext() {
    const s = state.setup;
    let error = "";
    if (s.step === 0 && !s.url.trim()) error = "Enter the address of your server.";
    if (s.step === 1 && (!s.password || !s.main.trim())) error = "Enter a password and name the main bot.";
    if (s.step === 2) error = authError(s);
    s.error = error;
    if (error) { render({ preserve: true }); return; }
    if (s.step === 2) {
      location.hash = homeHash();
      return;
    }
    s.step += 1;
    render({ preserve: true });
  }

  function setupView() {
    const s = state.setup;
    const back = s.step ? '<button type="button" class="ghost" data-act="setup-back">Back</button>' : "";
    const next = s.step === 0 ? "Connect" : "Continue";
    return '<div class="login"><div class="login-card"><div class="wordmark" style="margin-bottom:18px">Botsman</div>' +
      setupFields(s) +
      (s.error ? '<div class="err">' + esc(s.error) + "</div>" : "") +
      '<div class="choices">' + back + '<button type="button" class="primary" data-act="setup-next">' + esc(next) + "</button></div></div></div>";
  }
  function setPart(target, key, value) {
    target[key] = value;
  }
  function noteField(rest, value) {
    const bits = rest.split(":");
    const note = notesFor(bits[0]).filter(function (n) { return n.id === bits[1]; })[0];
    if (note) note[bits[2]] = value;
  }
  function memField(rest, value) {
    const bits = rest.split(":");
    setFileText(bits[0], bits[1], value);
    const count = document.getElementById("mem-count");
    if (count) count.textContent = value.length.toLocaleString("en-US") + " / " + LIMITS[bits[1]].toLocaleString("en-US") + " characters";
  }
  function noteQuery(botId, value) {
    state.noteQuery = value;
    const rows = document.getElementById("note-rows");
    if (rows) rows.innerHTML = noteRows(botId);
  }
  function fieldInput(f, t) {
    const cut = f.indexOf(":");
    const head = cut < 0 ? f : f.slice(0, cut);
    const rest = cut < 0 ? "" : f.slice(cut + 1);
    if (head === "bot") { const b = activeSettingsBot(); if (b) setPart(b, rest, t.value); return; }
    if (head === "mem") { memField(rest, t.value); return; }
    if (head === "note") { noteField(rest, t.value); return; }
    if (head === "note-q") { noteQuery(rest, t.value); return; }
    if (head === "cfg-wait") { cfgFor(rest).wait = t.value; return; }
    if (head === "step-text") { state.stepText = t.value; return; }
    const targets = { mcp: state.addMcp, key: state.addKey, "new": state.newBot, setup: state.setup };
    if (targets[head]) setPart(targets[head], rest, t.value);
    if (rest === "provider") render({ preserve: true });
  }
  function activeSettingsBot() { return route.parts[0] === "bot" ? botBy(route.parts[1]) : null; }

  function mainView() {
    const a = route.parts[0], b = route.parts[1], c = route.parts[2];
    if (a === "routines" && b) return routinesView(b);
    if (a === "routines") return routinesView(null);
    if (a === "routine" && (b === "new" || b === "edit")) return formView();
    if (a === "routine" && b === "runs") return runsView(c);
    if (a === "room") return roomColumn(b);
    if (a === "usage") return usageView();
    if (a === "bot" && b === "new") return newBotView();
    if (a === "bot") return botView(b || "junior");
    if (a === "memory") return memoryView(b || "junior");
    if (a === "notes" && c) return noteView(b, c);
    if (a === "notes") return notesView(b || "junior");
    if (a === "bot-settings") return botSettingsView(b || "junior");
    if (a === "convo") return convoView(b);
    if (a === "providers") return providersView();
    if (a === "settings") return settingsView();
    if (a === "notifications") return notifView();
    if (a === "chat") return chatColumn(b || "junior");
    return chatColumn("junior");
  }
  function inner() {
    const a = route.parts[0];
    if (a === "login") return loginView();
    if (a === "setup") return setupView();
    if (a === "update") return device() === "phone" ? listPage() : '<div class="shell">' + sidebar() + chatColumn("junior") + "</div>";
    if (device() === "phone" && (!a || a === "bots")) return listPage();
    const main = mainView();
    if (device() === "phone") return main;
    return '<div class="shell">' + sidebar() + main + "</div>";
  }
  function chrome() {
    if (device() === "desktop") {
      return '<div class="titlebar"><span>Botsman</span><span class="caption"><span>' + svg(IC.min, 14) + "</span><span>" + svg(IC.max, 12) + "</span><span>" + svg(IC.close, 14) + "</span></span></div>";
    }
    return '<div class="status"><span class="status-time">' + nowTime() + '</span><span class="status-icons">' + svg(IC.wifi, 16) + svg(IC.bat, 18) + "</span></div>";
  }
  function captureScroll() {
    const pane = document.querySelector(".pane");
    const side = document.querySelector(".side-scroll");
    const extra = [];
    document.querySelectorAll(".card-body, .pop").forEach(function (el) { extra.push(el.scrollTop); });
    return { pane: pane ? pane.scrollTop : 0, side: side ? side.scrollTop : 0, extra: extra };
  }
  function scrollToHighlight(pane) {
    if (!state.highlight || !pane) return;
    const el = document.getElementById("msg-" + state.highlight);
    if (!el) return;
    const paneRect = pane.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    pane.scrollTop += rect.top - paneRect.top - 16;
  }
  function applyScroll(opt, saved) {
    const pane = document.querySelector(".pane");
    const side = document.querySelector(".side-scroll");
    if (opt.scroll === "bottom" && pane) {
      pane.scrollTop = pane.scrollHeight;
      return;
    }
    if (opt.scroll === "message") {
      scrollToHighlight(pane);
      return;
    }
    if (opt.scroll === "top") {
      if (pane) pane.scrollTop = 0;
      const card = document.querySelector(".clarify");
      const landingId = route.parts[0] === "chat" ? { junior: "j-brief", nightwatch: "n1", ledger: "l1" }[route.parts[1]] : "";
      const landing = !card && landingId ? document.getElementById("msg-" + landingId) : null;
      const target = card || landing;
      if (target && pane) {
        const paneRect = pane.getBoundingClientRect();
        const rect = target.getBoundingClientRect();
        pane.scrollTop += rect.top - paneRect.top - 8;
      }
      return;
    }
    if (pane) pane.scrollTop = saved.pane;
    if (side) side.scrollTop = saved.side;
    const nodes = document.querySelectorAll(".card-body, .pop");
    saved.extra.forEach(function (v, i) { if (nodes[i]) nodes[i].scrollTop = v; });
  }
  function render(opt) {
    opt = opt || {};
    const saved = captureScroll();
    const focus = opt.focus || state.focusId;
    const focusAt = state.focusAt;
    document.getElementById("app").innerHTML = '<div class="app">' + chrome() + '<div class="fill">' + inner() + "</div>" +
      (route.parts[0] === "update" ? updateModal() : "") + "</div>";
    applyScroll(opt, saved);
    if (focus) {
      const el = document.getElementById(focus);
      if (el && el.focus) {
        try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
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
    requestAnimationFrame(function () {
      applyScroll(opt, saved);
      requestAnimationFrame(function () { applyScroll(opt, saved); });
    });
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
    const text = state.composer.trim();
    if (!text || !bot) return;
    currentThread(bot.id).push({ id: uid(), role: "system", text: "Steered · " + text });
    state.composer = "";
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
    list.push({
      id: uid(), role: "user", time: nowTime(), text: text, replyTo: state.replyTo,
      image: img && img.src, imageName: img && img.name,
      file: file ? { name: file.name, size: file.size || "" } : null
    });
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
  function summarize(botId) {
    const bot = botBy(botId);
    if (!bot) return;
    currentThread(bot.id).push({ id: uid(), role: "system", text: "Earlier messages were summarized." });
    state.menu = false;
    render({ scroll: "bottom" });
  }
  function activeLog() {
    const bot = activeBot();
    if (bot) return currentThread(bot.id);
    const room = activeRoom();
    if (!room) return null;
    roomLogs[room.id] = roomLogs[room.id] || [];
    return roomLogs[room.id];
  }
  function runCommand(name) {
    const list = activeLog();
    if (!list) return;
    const bot = activeBot();
    state.composer = "";
    state.slashIndex = 0;
    if ((name === "memory" || name === "notes") && bot) {
      location.hash = "#/" + name + "/" + bot.id;
      return;
    }
    if (name === "compact") {
      list.push({ id: uid(), role: "system", text: "Earlier messages were summarized." });
    } else if (name === "clear") {
      list.push({ id: uid(), role: "system", text: "Context cleared. The transcript stays on screen." });
    } else if (name === "skills") {
      list.push({ id: uid(), role: "system", text: "Skills on for this bot: calendar, github, memory." });
    } else if (name === "usage") {
      const tokens = list.reduce(function (s, m) { return s + ((m.usage && m.usage.tokens) || 0); }, 0);
      list.push({ id: uid(), role: "system", text: "This chat · " + toks(tokens) + " · " + money(chatCost(list)) + "." });
    }
    render({ scroll: "bottom", focus: "composer" });
  }
  function enterComposer() {
    const matches = slashMatches();
    if (slashQuery() !== null && matches.length) {
      runCommand(matches[state.slashIndex].name);
      return;
    }
    const room = activeRoom();
    if (room) doSendRoom(room);
    else if (activeBot()) doSend(activeBot());
  }
  function runNow(id) {
    const job = routines.filter(function (r) { return r.id === id; })[0];
    if (!job) return;
    const name = botName(job.bot);
    const mid = uid();
    job.runs.unshift({ when: "Just now", status: "Succeeded", detail: "Posted into the chat.", msg: mid });
    const key = job.bot + ":main";
    if (!threads[key]) threads[key] = [];
    state.minute += 1;
    threads[key].push({ id: mid, role: "routine", who: job.bot, routine: job.name, time: nowTime(), text: job.result || "Ran just now." });
    const b = botBy(job.bot);
    if (b) {
      b.preview = (job.result || "Ran just now.").slice(0, 90);
      b.time = nowTime();
      b.activity = 1000 + state.minute;
    }
    state.toast = { text: "Posted into " + name + "'s chat.", to: "#/chat/" + job.bot, bot: job.bot, msg: mid };
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
        chat: !!f.chat, ntfy: !!f.ntfy, memory: !!f.memory, paused: false, result: "Ran just now. Posted into this chat.", runs: []
      });
    } else {
      const j = routines.filter(function (r) { return r.id === f.id; })[0];
      if (j) Object.assign(j, {
        name: f.name.trim(), prompt: f.prompt, freq: f.freq, time: f.time, onceDate: f.onceDate,
        days: (f.days || []).slice(), cron: cron, cronDirty: !!f.cronDirty, chat: !!f.chat, ntfy: !!f.ntfy, memory: !!f.memory
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
    ["queue-btn", "steer-btn"].forEach(function (id) {
      const button = document.getElementById(id);
      if (button) button.disabled = !has;
    });
  }
  function onComposer(el) {
    state.composer = el.value;
    state.slashIndex = 0;
    syncSend();
    paintSlash();
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }

  const ACT = {
    nav: function (el) { location.hash = el.dataset.to; },
    "open-bot": function (el) {
      const b = botBy(el.dataset.id);
      if (b) b.unread = 0;
      state.highlight = null;
      state.highlightBot = null;
      location.hash = "#/chat/" + el.dataset.id;
    },
    "open-run": function (el) {
      const bot = el.dataset.bot;
      const msg = el.dataset.msg;
      if (!bot || !msg) return;
      state.highlight = msg;
      state.highlightBot = bot;
      const next = "#/chat/" + bot;
      if ((location.hash || "").split("?")[0] === next) {
        route = parse();
        onRoute();
        render({ scroll: "message" });
      } else location.hash = next;
    },
    summarize: function (el) { summarize(el.dataset.id); },
    slash: function (el) { runCommand(el.dataset.id); },
    "slash-ins": function () {
      const el = document.getElementById("composer");
      if (!el) return;
      if ((state.composer || "").charAt(0) !== "/") {
        state.composer = "/" + (state.composer || "");
        el.value = state.composer;
        try { el.setSelectionRange(1, 1); } catch (e) { /* ignore */ }
      }
      state.slashIndex = 0;
      paintSlash();
      syncSend();
      try { el.focus({ preventScroll: true }); } catch (e2) { el.focus(); }
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
    "delete-ask": function (el) { state.confirmDelete = el.dataset.id; render({ preserve: true }); },
    "delete-no": function () { state.confirmDelete = null; render({ preserve: true }); },
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
        chat: !!t.chat, ntfy: !!t.ntfy, memory: false, error: ""
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
    "form-memory": function () { state.form.memory = !state.form.memory; render({ preserve: true }); },
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
      const port = parseInt(a.port, 10) || 443;
      state.servers.push({ id: uid(), name: a.name.trim(), host: a.host.trim(), port: port });
      state.addServer = { name: "", host: "", port: "443", error: "" };
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
    "mem-file": function (el) {
      state.memFile[el.dataset.bot] = el.dataset.id;
      state.memSaved = null;
      state.memError = "";
      render({ preserve: true });
    },
    "mem-save": function (el) {
      const file = el.dataset.id;
      const over = fileText(el.dataset.bot, file).length > LIMITS[file];
      state.memError = over ? file + ".md is over its limit. Trim it, then save." : "";
      state.memSaved = over ? null : file;
      if (!over) state.memEditing = null;
      render({ preserve: true });
    },
    "mem-edit": function (el) { state.memEditing = el.dataset.bot + ":" + el.dataset.id; state.memSaved = null; render({ preserve: true }); },
    "mem-cancel": function () { state.memEditing = null; render({ preserve: true }); },
    "proposal-yes": function (el) { settleProposal(el.dataset.id, true); },
    "proposal-no": function (el) { settleProposal(el.dataset.id, false); },
    "note-new": function (el) {
      const botId = el.dataset.bot;
      const id = uid();
      notesFor(botId).unshift({ id: id, name: "untitled.md", updated: "Just now", text: "" });
      state.noteEditing = id;
      location.hash = "#/notes/" + botId + "/" + id;
    },
    "note-save": function () { state.noteSaved = true; state.noteEditing = null; render({ preserve: true }); },
    "note-edit": function (el) { state.noteEditing = el.dataset.id; state.noteSaved = false; render({ preserve: true }); },
    "delete-note": function (el) {
      const list = notesFor(el.dataset.bot);
      const i = list.findIndex(function (n) { return n.id === el.dataset.id; });
      if (i >= 0) list.splice(i, 1);
      location.hash = "#/notes/" + el.dataset.bot;
    },
    "cfg-mode": function (el) { cfgFor(el.dataset.bot).mode = el.dataset.id; render({ preserve: true }); },
    "cfg-network": function (el) {
      const cfg = cfgFor(el.dataset.bot);
      cfg.network = !cfg.network;
      render({ preserve: true });
    },
    "cfg-host-shell": function (el) {
      const cfg = cfgFor(el.dataset.bot);
      cfg.hostShell = !cfg.hostShell;
      render({ preserve: true });
    },
    "setup-host-shell": function () {
      state.setup.hostShell = !state.setup.hostShell;
      render({ preserve: true });
    },
    "cfg-mcp": function (el) {
      const cfg = cfgFor(el.dataset.bot);
      cfg.mcp[el.dataset.id] = !cfg.mcp[el.dataset.id];
      render({ preserve: true });
    },
    "cfg-skill": function (el) {
      const cfg = cfgFor(el.dataset.bot);
      cfg.skills[el.dataset.id] = !cfg.skills[el.dataset.id];
      render({ preserve: true });
    },
    "mcp-add": function () {
      const a = state.addMcp;
      if (!a.name.trim() || !a.url.trim()) { a.error = "Name and address are both required."; render({ preserve: true }); return; }
      HB.mcp.push({ id: uid(), name: a.name.trim(), detail: a.url.trim() });
      state.addMcp = { name: "", url: "", error: "" };
      render({ preserve: true });
    },
    "convo-resume": function (el) {
      const chat = chatById(el.dataset.id);
      if (chat) chat.paused = false;
      render({ preserve: true });
    },
    "step-in": function (el) {
      state.stepIn[el.dataset.id] = true;
      render({ scroll: "bottom", focus: "step-text" });
    },
    "step-send": function (el) {
      const chat = chatById(el.dataset.id);
      const text = state.stepText.trim();
      if (!chat || !text) return;
      state.minute += 1;
      chat.messages.push({ id: uid(), role: "user", time: nowTime(), text: text });
      state.stepText = "";
      chat.paused = false;
      render({ scroll: "bottom", focus: "step-text" });
    },
    "provider-add": function () {
      const a = state.addKey;
      a.provider = providerOpen();
      a.error = authError(a);
      if (a.error) { render({ preserve: true }); return; }
      const auth = authMethod(a);
      state.providers = state.providers.filter(function (p) { return p.name !== a.provider; });
      state.providers.push({ name: a.provider, auth: auth, saved: "Just now" });
      closeConnect();
    },
    "provider-open": function (el) {
      Object.assign(state.addKey, { open: el.dataset.id, method: HB.providerAuth[el.dataset.id][0], key: "", callback: "", error: "" });
      render({ preserve: true });
    },
    "provider-cancel": function () { closeConnect(); },
    "usage-label": function (el) {
      const target = el.dataset.head === "setup" ? state.setup : state.addKey;
      target.usageLabel = el.dataset.id;
      render({ preserve: true });
    },
    "auth-method": function (el) {
      (el.dataset.head === "setup" ? state.setup : state.addKey).method = el.dataset.id;
      render({ preserve: true });
    },
    "auth-open": function () { /* Opens the provider's page in the browser. */ },
    "provider-remove": function (el) {
      state.providers = state.providers.filter(function (p) { return p.name !== el.dataset.id; });
      state.confirmDelete = null;
      render({ preserve: true });
    },
    "bot-create": function () { createBot(); },
    "delete-bot": function (el) {
      const i = bots.findIndex(function (b) { return b.id === el.dataset.id; });
      if (i >= 0) deletedBots.push(Object.assign(bots.splice(i, 1)[0], { deleted: true }));
      location.hash = homeHash();
    },
    "restore-bot": function (el) {
      const i = deletedBots.findIndex(function (b) { return b.id === el.dataset.id; });
      if (i >= 0) bots.push(Object.assign(deletedBots.splice(i, 1)[0], { deleted: false }));
      render({ preserve: true });
    },
    "restore-no": function () { state.restoreDeclined = true; render({ preserve: true }); },
    "setup-next": function () { setupNext(); },
    "setup-skip": function () { location.hash = homeHash(); },
    "setup-back": function () {
      state.setup.step = Math.max(0, state.setup.step - 1);
      state.setup.error = "";
      render({ preserve: true });
    },
    reconnect: function () {
      state.reconnect = "ok";
      render({ preserve: true });
      setTimeout(function () {
        if (state.reconnect === "ok") { state.reconnect = null; render({ preserve: true }); }
      }, 1600);
    }
  };

  function bind() {
    const app = document.getElementById("app");
    app.addEventListener("mousedown", function (e) {
      if (e.target.closest("button")) e.preventDefault();
    });
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
      if (changed) render({ preserve: true });
    });
    app.addEventListener("input", function (e) {
      const t = e.target;
      if (t.id === "composer") { onComposer(t); return; }
      if (t.id === "steer") {
        state.steer = t.value;
        const b = document.getElementById("steer-btn");
        if (b) b.disabled = !t.value.trim();
        return;
      }
      if (t.id === "password") { state.loginPass = t.value; return; }
      if (t.id === "username") { state.loginUser = t.value; return; }
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
      fieldInput(f, t);
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
        const menu = slashQuery() !== null && slashMatches().length;
        if (menu && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
          e.preventDefault();
          const n = slashMatches().length;
          state.slashIndex = e.key === "ArrowDown" ? (state.slashIndex + 1) % n : (state.slashIndex - 1 + n) % n;
          paintSlash();
          const on = document.querySelector("#slash-host button.on");
          if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest" });
          return;
        }
        if (e.key === "Escape" && slashQuery() !== null) {
          e.preventDefault();
          state.composer = "";
          state.slashIndex = 0;
          t.value = "";
          paintSlash();
          syncSend();
          return;
        }
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enterComposer(); }
        return;
      }
      if (t.id === "password" && e.key === "Enter") ACT.login();
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
      if (e.key === "hb-theme" && ready) render({ preserve: true });
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
    if (ready) render({ scroll: state.highlight ? "message" : "top" });
  });

  function boot() {
    try { localStorage.removeItem("hb-flavor"); } catch (e) { /* ignore */ }
    document.documentElement.removeAttribute("data-flavor");
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

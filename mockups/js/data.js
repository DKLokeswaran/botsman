/* Sample data only. Nothing here is loaded from a server. */
const HB = {
  user: "lokeswaran",
  version: "0.1.0",
  nextVersion: "0.2.0",
  models: ["Haiku 4.5", "Sonnet 4.5", "Opus 4.5", "GPT-5", "Gemini 2.5 Pro"],
  efforts: ["Low", "Medium", "High", "Extra high"],
  commands: [
    { name: "compress", hint: "Summarize this chat into the context" },
    { name: "clear", hint: "Clear this chat's context" },
    { name: "skills", hint: "Skills this bot can use" },
    { name: "personality", hint: "How this bot speaks" },
    { name: "usage", hint: "Tokens and cost for this chat" },
    { name: "undo", hint: "Undo the last turn" },
    { name: "help", hint: "Commands in this chat" }
  ],
  marks: ["junior", "atlas", "ledger", "quartermaster", "scribe", "nightwatch", "diamond", "waves"],
  bots: [
    {
      id: "junior",
      name: "Junior",
      description: "Everyday assistant",
      about: "Everyday assistant. The main profile. Routines land in this chat.",
      model: "Sonnet 4.5",
      effort: "High",
      mark: "junior",
      pinned: true,
      activity: 90,
      time: "7:04",
      preview: "Gym is Thursday 06:30. I'll nudge you at 15:30.",
      unread: 0,
      working: false,
      needs: null
    },
    {
      id: "nightwatch",
      name: "Nightwatch",
      description: "Deploys and server health",
      about: "Deploys and server health.",
      model: "Sonnet 4.5",
      effort: "Medium",
      mark: "nightwatch",
      pinned: false,
      activity: 100,
      time: "7:40",
      preview: "Looking at run 1842…",
      unread: 0,
      working: true,
      needs: null,
      queue: ["Also check the staging logs"]
    },
    {
      id: "ledger",
      name: "Ledger",
      description: "Money, invoices, subscriptions",
      about: "Money, invoices, subscriptions.",
      model: "Sonnet 4.5",
      effort: "Medium",
      mark: "ledger",
      pinned: false,
      activity: 80,
      time: "6:58",
      preview: "I need a yes before I merge.",
      unread: 0,
      working: false,
      needs: "approval"
    },
    {
      id: "atlas",
      name: "Atlas",
      description: "Research and long reads",
      about: "Research and long reads.",
      model: "Opus 4.5",
      effort: "High",
      mark: "atlas",
      pinned: false,
      activity: 70,
      time: "7:12",
      preview: "Which sources should I use?",
      unread: 2,
      working: false,
      needs: "question"
    },
    {
      id: "quartermaster",
      name: "Quartermaster",
      description: "Home, errands, reminders",
      about: "Home, errands, reminders.",
      model: "Haiku 4.5",
      effort: "Low",
      mark: "quartermaster",
      pinned: false,
      activity: 40,
      time: "6:10",
      preview: "Bins go out tonight.",
      unread: 0,
      working: false,
      needs: null
    },
    {
      id: "scribe",
      name: "Scribe",
      description: "Drafts and rewrites",
      about: "Drafts and rewrites.",
      model: "GPT-5",
      effort: "Medium",
      mark: "scribe",
      pinned: false,
      activity: 10,
      time: "Yesterday",
      preview: "The shorter opener works.",
      unread: 0,
      working: false,
      needs: null
    }
  ],
  rooms: [
    {
      id: "standup",
      name: "Standup",
      members: ["junior", "atlas", "nightwatch"],
      preview: "Nightwatch: @Junior Run 1842 died in the migrate step."
    },
    {
      id: "house",
      name: "House",
      members: ["junior", "quartermaster", "ledger"],
      preview: "Junior: Thursday after the gym works if you're back by 9."
    }
  ],
  servers: [
    { id: "devbox", name: "devbox", host: "100.101.102.10", port: 9119 },
    { id: "laptop", name: "laptop", host: "100.101.102.21", port: 9119 }
  ],
  notifications: [
    { id: "routine-ok", label: "A routine finished" },
    { id: "routine-fail", label: "A routine failed" },
    { id: "approval", label: "An approval is waiting" },
    { id: "question", label: "A question is waiting" },
    { id: "long", label: "A long reply finished" },
    { id: "errors", label: "Errors" }
  ],
  usageDays: [0.42, 0.88, 1.2, 0.64, 1.55, 2.1, 0.95, 1.4, 0.7, 1.85, 2.4, 1.15, 1.62, 1.54],
  usageByBot: [
    ["junior", 9.1],
    ["atlas", 6.2],
    ["nightwatch", 2.4],
    ["ledger", 0.45],
    ["quartermaster", 0.15],
    ["scribe", 0.1]
  ],
  usageChats: [
    { bot: "junior", title: "Main", cost: 4.8 },
    { bot: "atlas", title: "Migration memo", cost: 3.1 },
    { bot: "nightwatch", title: "Deploy watch", cost: 1.2 },
    { bot: "junior", title: "Tuesday plan", cost: 0.05 },
    { bot: "ledger", title: "Main", cost: 0.22 }
  ],
  templates: [
    {
      id: "t-brief",
      name: "Morning briefing",
      prompt: "Summarise today: calendar, anything due, and notes other bots left. Post it in this chat.",
      freq: "weekdays",
      time: "07:00",
      days: [1, 2, 3, 4, 5],
      chat: true,
      ntfy: true
    },
    {
      id: "t-inbox",
      name: "Inbox sweep",
      prompt: "List what is waiting on me and draft replies. Do not send anything.",
      freq: "weekdays",
      time: "08:30",
      days: [1, 2, 3, 4, 5],
      chat: true,
      ntfy: false
    },
    {
      id: "t-deploy",
      name: "Deploy watch",
      prompt: "Check the latest deploy. If it failed, say what broke in one paragraph.",
      freq: "cron",
      cron: "0 * * * *",
      time: "00:00",
      days: [],
      chat: true,
      ntfy: true
    },
    {
      id: "t-week",
      name: "Weekly review",
      prompt: "What moved this week, what is still open, and one thing to drop.",
      freq: "weekly",
      time: "18:00",
      days: [0],
      chat: true,
      ntfy: true
    }
  ],
  routines: [
    {
      id: "morning",
      bot: "junior",
      name: "Morning briefing",
      prompt: "Summarise today: calendar, anything due, and notes other bots left. Post it in this chat.",
      freq: "weekdays",
      time: "07:00",
      days: [1, 2, 3, 4, 5],
      cron: "0 7 * * 1-5",
      cronDirty: false,
      chat: true,
      ntfy: true,
      paused: false,
      result: "Ran just now. Nothing new since the 7:00 briefing.",
      runs: [
        { when: "Today · 7:00", status: "Succeeded", detail: "Posted into the main chat.", msg: "j-brief" },
        { when: "Yesterday · 7:00", status: "Succeeded", detail: "Posted into the main chat.", msg: "j-brief-y" },
        { when: "Mon · 7:00", status: "Failed", detail: "Calendar tool timed out. Nothing was posted." }
      ]
    },
    {
      id: "dentist",
      bot: "junior",
      name: "Dentist nudge",
      prompt: "Nudge me to leave for the dentist.",
      freq: "once",
      time: "15:30",
      onceDate: "2026-10-27",
      days: [],
      cron: "30 15 27 10 *",
      cronDirty: false,
      chat: true,
      ntfy: true,
      paused: true,
      result: "Ran just now. Leave now if you're still at home.",
      runs: []
    },
    {
      id: "sunday",
      bot: "junior",
      name: "Sunday review",
      prompt: "What moved this week, what is still open, and one thing to drop.",
      freq: "weekly",
      time: "18:00",
      days: [0],
      cron: "0 18 * * 0",
      cronDirty: false,
      chat: true,
      ntfy: false,
      paused: false,
      result: "Ran just now. The week is still open: the memo, and the dentist today.",
      runs: [
        { when: "Last Sunday · 18:00", status: "Succeeded", detail: "Posted into the main chat.", msg: "j-sunday" }
      ]
    },
    {
      id: "deploy",
      bot: "nightwatch",
      name: "Deploy watch",
      prompt: "Check the latest deploy. If it failed, say what broke in one paragraph.",
      freq: "cron",
      time: "00:00",
      days: [],
      cron: "0 * * * *",
      cronDirty: true,
      chat: true,
      ntfy: true,
      paused: false,
      result: "Ran just now. Run 1842 is still the latest, and it failed at migrate.",
      runs: [
        { when: "Today · 7:00", status: "Succeeded", detail: "Posted into the main chat.", msg: "n-deploy-7" },
        { when: "Today · 6:00", status: "Failed", detail: "The workflow API did not answer. Nothing was posted." }
      ]
    },
    {
      id: "invoices",
      bot: "ledger",
      name: "Invoice sweep",
      prompt: "List bills due in the next seven days. Do not pay anything.",
      freq: "weekdays",
      time: "09:00",
      days: [1, 2, 3, 4, 5],
      cron: "0 9 * * 1-5",
      cronDirty: false,
      chat: true,
      ntfy: true,
      paused: false,
      result: "Ran just now. The electricity bill is the only one due this week.",
      runs: [
        { when: "Yesterday · 9:00", status: "Succeeded", detail: "Posted into the main chat.", msg: "l-invoice" }
      ]
    },
    {
      id: "reading",
      bot: "atlas",
      name: "Reading list",
      prompt: "One paragraph on what I saved and have not read.",
      freq: "weekly",
      time: "09:00",
      days: [0],
      cron: "0 9 * * 0",
      cronDirty: false,
      chat: true,
      ntfy: false,
      paused: true,
      result: "Ran just now. Two saved pieces are still unread.",
      runs: []
    }
  ],
  questions: [
    {
      id: "q1",
      multi: true,
      prompt: "Which sources should I use?",
      options: ["Notes already in this chat", "Primary papers", "The news"]
    },
    {
      id: "q2",
      multi: false,
      prompt: "How long should it be?",
      options: ["Half a page", "Two pages", "As long as it needs"]
    },
    {
      id: "q3",
      multi: false,
      prompt: "What tone?",
      options: ["Plain", "Formal"]
    },
    {
      id: "q4",
      multi: false,
      prompt: "Citations?",
      options: ["Footnotes", "Names only", "None"]
    },
    {
      id: "q5",
      multi: false,
      prompt: "When do you want it?",
      options: ["Today", "This week", "No deadline"]
    }
  ]
};

HB.photo = "data:image/svg+xml," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320">' +
  '<rect width="480" height="320" fill="#f3f3f3"/>' +
  '<rect x="28" y="24" width="424" height="272" fill="#fff" stroke="#111" stroke-width="3"/>' +
  '<text x="52" y="78" font-family="Segoe UI, sans-serif" font-size="18" fill="#666">Electricity bill</text>' +
  '<text x="52" y="140" font-family="Segoe UI, sans-serif" font-size="42" fill="#111">Due Friday</text>' +
  '<text x="52" y="190" font-family="Segoe UI, sans-serif" font-size="16" fill="#444">October statement, page 1</text>' +
  "</svg>"
);

HB.sessions = {
  junior: [
    { id: "main", title: "Main", main: true, pinned: true, auto: false, when: "Today", preview: "Gym is Thursday 06:30.", sort: 50 },
    { id: "pack", title: "Packing list for Friday", main: false, pinned: true, auto: true, when: "Today", preview: "Passport, charger, the blue shirt.", sort: 30 },
    { id: "tue", title: "Tuesday plan", main: false, pinned: false, auto: true, when: "Today", preview: "Keep Friday light.", sort: 20 },
    { id: "inv", title: "Electricity bill", main: false, pinned: false, auto: true, when: "Yesterday", preview: "Due Friday. Matches the letter.", sort: 10 },
    { id: "old1", title: "Grocery run", main: false, pinned: false, auto: true, archived: true, when: "Last week", preview: "Milk, rice, coffee.", sort: 2 },
    { id: "old2", title: "Airport pickup", main: false, pinned: false, auto: true, archived: true, when: "Last week", preview: "Terminal 2, 18:10.", sort: 1 }
  ]
};

HB.threads = {};

HB.threads["junior:main"] = [
  {
    id: "j-brief-y",
    role: "routine",
    who: "junior",
    routine: "Morning briefing",
    time: "Yesterday",
    text: "Monday 26 Oct.\n\nNo dentist. Gym stayed at 18:30. Nothing due."
  },
  {
    id: "j-sunday",
    role: "routine",
    who: "junior",
    routine: "Sunday review",
    time: "Sun",
    text: "The memo is still unsent. The dentist is the only fixed point this week."
  },
  {
    id: "j-hand-ledger",
    role: "handoff",
    from: "junior",
    to: "ledger",
    time: "6:40",
    text: "Check the electricity bill before Friday. Don't pay it."
  },
  {
    id: "j-hand-night",
    role: "handoff",
    from: "junior",
    to: "nightwatch",
    time: "7:33",
    text: "Read the failed deploy log for run 1842 and say what broke."
  },
  {
    id: "j-brief",
    role: "routine",
    who: "junior",
    routine: "Morning briefing",
    time: "7:02",
    text: "Tuesday 27 Oct.\n\nDentist is 16:00 to 16:45. Gym is on today at 18:30. Ledger flagged the electricity bill, due this week. Atlas left the migration memo drafted and unsent.\n\nI can move the gym, chase the bill, or leave the memo until you say."
  },
  {
    id: "j-user",
    role: "user",
    time: "7:03",
    replyTo: "j-brief",
    text: "Move the gym block to Thursday morning. Leave the memo."
  },
  {
    id: "j-reply",
    role: "assistant",
    who: "junior",
    time: "7:04",
    thinking: {
      seconds: 6,
      open: false,
      text: "They want the gym on Thursday morning, not this evening. Last week's morning slot was 06:30, and Thursday 06:30 is free. The dentist stays at 16:00, so a 15:30 nudge still holds. They said to leave the memo, so I will not touch Atlas's draft."
    },
    tools: [
      {
        id: "t1",
        line: "Ran: calendar.list",
        input: '{ "range": "today through Thursday", "calendar": "personal" }',
        output: "Tue 16:00  Dentist\nTue 18:30  Gym\nThu 06:30  free"
      },
      {
        id: "t2",
        line: "Ran: calendar.update",
        input: '{ "title": "Gym", "to": "Thu 06:30-07:30" }',
        output: "Moved. Thursday 06:30 to 07:30."
      }
    ],
    todos: [
      { done: true, text: "Move gym to Thursday 06:30" },
      { done: true, text: "Leave the migration memo" },
      { done: false, text: "Remind you at 15:30 about the dentist" }
    ],
    html:
      "<p>Done. Gym is Thursday 06:30 to 07:30. The memo stays in Atlas's drafts.</p>" +
      "<p>Leave for the dentist at 15:30. I'll nudge you then.</p>" +
      '<div class="table-wrap"><table><thead><tr><th>When</th><th>What</th></tr></thead><tbody>' +
      "<tr><td>Today</td><td>Gym moved off this evening</td></tr>" +
      "<tr><td>15:30</td><td>Nudge to leave</td></tr>" +
      "<tr><td>16:00</td><td>Dentist</td></tr>" +
      "<tr><td>Thu 06:30</td><td>Gym</td></tr>" +
      "</tbody></table></div>",
    diff: {
      file: "notes/household.md",
      lines: [
        { t: "del", s: "Gym: Tue 18:30" },
        { t: "add", s: "Gym: Thu 06:30" },
        { t: "ctx", s: "Dentist: Tue 16:00" }
      ]
    },
    usage: { tokens: 1842, cost: 0.04 }
  },
  {
    id: "j-user2",
    role: "user",
    time: "7:05",
    text: "Show the one-liner you used to update the note."
  },
  {
    id: "j-code",
    role: "assistant",
    who: "junior",
    time: "7:05",
    text: "This only updates the note. The calendar write already happened.",
    code: {
      lang: "bash",
      text: "printf '%s\\n' 'Gym: Thu 06:30' >> ~/notes/household.md"
    },
    usage: { tokens: 210, cost: 0.01 }
  }
];

HB.threads["junior:pack"] = [
  { id: "p1", role: "user", time: "6:38", text: "What should I pack for Friday?" },
  {
    id: "p2",
    role: "assistant",
    who: "junior",
    time: "6:40",
    text: "Passport, charger, the blue shirt, and a jumper. It will be about 14 degrees in the evening.",
    usage: { tokens: 320, cost: 0.01 }
  }
];

HB.threads["junior:tue"] = [
  { id: "u1", role: "user", time: "6:11", text: "Sketch Tuesday, and keep Friday light." },
  {
    id: "u2",
    role: "assistant",
    who: "junior",
    time: "6:12",
    text: "Tuesday holds the dentist and nothing else heavy. Friday stays empty apart from the trip.",
    usage: { tokens: 240, cost: 0.01 }
  }
];

HB.threads["junior:inv"] = [
  { id: "i1", role: "user", time: "Yesterday", text: "Does this match the letter Ledger saw?" },
  {
    id: "i2",
    role: "assistant",
    who: "junior",
    time: "Yesterday",
    text: "Yes. Due Friday, and it is the same bill Ledger flagged this morning.",
    usage: { tokens: 180, cost: 0.01 }
  }
];

HB.threads["nightwatch:main"] = [
  {
    id: "n-deploy-7",
    role: "routine",
    who: "nightwatch",
    routine: "Deploy watch",
    time: "7:00",
    text: "Run 1842 failed in the migrate step. Staging rejected the new column."
  },
  {
    id: "n-hand",
    role: "handoff",
    from: "junior",
    to: "nightwatch",
    time: "7:33",
    text: "Read the failed deploy log for run 1842 and say what broke."
  },
  { id: "n1", role: "user", time: "7:39", text: "Check why the deploy workflow failed." },
  {
    id: "n2",
    role: "assistant",
    who: "nightwatch",
    time: "7:40",
    streaming: true,
    thinking: {
      seconds: 12,
      open: true,
      streaming: true,
      text: "Run 1842 is the latest on main. 1831 was the last success. The job name is migrate. I want the failed step before I guess."
    },
    tools: [
      {
        id: "n-t1",
        line: "Ran: gh run list",
        input: '{ "workflow": "deploy", "limit": 5 }',
        output: "1842  failed   migrate   main   7:11\n1831  success  migrate   main   yesterday"
      },
      {
        id: "n-t2",
        line: "Running: gh run view 1842",
        running: true,
        input: '{ "run": 1842, "log-failed": true }',
        output: "Waiting for the failed-step log…"
      }
    ],
    todos: [
      { done: true, text: "List recent runs" },
      { done: false, text: "Read the failed step" },
      { done: false, text: "Say what broke" }
    ],
    text: ""
  }
];

HB.threads["ledger:main"] = [
  {
    id: "l-invoice",
    role: "routine",
    who: "ledger",
    routine: "Invoice sweep",
    time: "Yesterday",
    text: "The electricity bill is the only one due this week. Nothing was paid."
  },
  {
    id: "l-hand",
    role: "handoff",
    from: "junior",
    to: "ledger",
    time: "6:40",
    text: "Check the electricity bill before Friday. Don't pay it."
  },
  { id: "l1", role: "user", time: "6:57", text: "Ship the invoice fix if the checks are green." },
  {
    id: "l2",
    role: "assistant",
    who: "ledger",
    time: "6:58",
    text: "Checks are green. I need a yes before I merge pull request 482.",
    usage: { tokens: 640, cost: 0.02 }
  }
];

HB.threads["atlas:main"] = [
  { id: "a1", role: "user", time: "7:10", text: "Write the migration memo." },
  {
    id: "a2",
    role: "assistant",
    who: "atlas",
    time: "7:12",
    text: "I can draft it once I know the shape.",
    usage: { tokens: 410, cost: 0.03 }
  }
];

HB.threads["quartermaster:main"] = [
  {
    id: "q1",
    role: "routine",
    who: "quartermaster",
    routine: "Evening house note",
    time: "6:10",
    text: "Bins go out tonight. The electrician can do Thursday after the gym."
  }
];

HB.threads["scribe:main"] = [
  { id: "s1", role: "user", time: "Yesterday", text: "Cut this opener in half." },
  {
    id: "s2",
    role: "assistant",
    who: "scribe",
    time: "Yesterday",
    text: "The shorter opener works. I left the second sentence out.",
    usage: { tokens: 260, cost: 0.01 }
  }
];

HB.attachThread = [
  {
    id: "at1",
    role: "user",
    time: "6:20",
    text: "The electricity letter.",
    image: HB.photo,
    imageName: "Pasted image"
  },
  {
    id: "at2",
    role: "assistant",
    who: "junior",
    time: "6:21",
    text: "That's the October bill, due Friday. It matches what Ledger flagged.",
    usage: { tokens: 980, cost: 0.02 }
  }
];

HB.roomsLog = {
  standup: [
    { id: "g1", role: "user", time: "7:31", text: "What broke overnight?" },
    {
      id: "g2",
      role: "bot",
      who: "junior",
      to: "you",
      time: "7:32",
      text: "Deploy on main failed. I asked Nightwatch to read the log."
    },
    {
      id: "g3",
      role: "bot",
      who: "nightwatch",
      to: "junior",
      time: "7:36",
      text: "Run 1842 died in the migrate step. Staging rejected the new column."
    },
    {
      id: "g4",
      role: "bot",
      who: "atlas",
      to: "junior",
      time: "7:37",
      text: "The memo does not depend on that deploy. I can send it whenever you want."
    },
    {
      id: "g5",
      role: "bot",
      who: "junior",
      to: "you",
      time: "7:38",
      text: "Nightwatch has the failure. Atlas can send the memo without waiting. Want me to hold the memo until the deploy is green?"
    }
  ],
  house: [
    {
      id: "h1",
      role: "bot",
      who: "quartermaster",
      to: "you",
      time: "6:12",
      text: "Bins go out tonight. The electrician can do Thursday after the gym."
    },
    {
      id: "h2",
      role: "bot",
      who: "ledger",
      to: "quartermaster",
      time: "6:14",
      text: "The electrician's invoice is already on this month's list."
    },
    {
      id: "h3",
      role: "bot",
      who: "junior",
      to: "you",
      time: "6:16",
      text: "Thursday after the gym works if you're back by 9."
    }
  ]
};

HB.approval = {
  title: "Merge pull request #482",
  description: "Squash-merge pull request 482 and delete its branch.",
  command: "gh pr merge 482 --squash --delete-branch"
};

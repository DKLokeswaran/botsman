import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { alertText, BackgroundAlerts, BotsmanClient, type LocalCache, type SocketLike, type BackgroundAlertsService, type ChatState, modelProblem, newNoteName, noteNameProblem, offeredSendModes, suggestedModel } from "../src/index.ts";
import type { Alert, Tokens } from "@botsman/protocol";
import { scriptSwitches } from "@botsman/server/src/testing/script-model.ts";
import { memoryTokenStore, PASSWORD, proxiedFetch, type Rig, startRig, until } from "./real-server.ts";

let rig: Rig;
let mainId: string;

beforeAll(async () => {
  rig = await startRig();
  mainId = (await until(rig.client.server, (state) => state.status === "ready")).bots[0]!.id;
});

afterAll(() => rig.stop());

const replied = (text: string) => (state: ChatState) => state.messages.some((message) => message.type === "assistant" && message.text.includes(text)) && !state.live.running;

describe("session", () => {
  it("signs in at setup, stores the tokens, and goes online", async () => {
    expect(rig.client.session.state.get()).toMatchObject({ status: "signed_in" });
    expect(rig.tokenStore.tokens?.refreshToken).toBeTruthy();
    await until(rig.client.connection.status, (status) => status === "online");
  });

  it("speaks a protocol the server accepts", async () => {
    expect(await rig.client.protocolFit()).toBe("fits");
  });

  it("renews an access token the server no longer accepts, and repeats the request", async () => {
    const before = rig.tokenStore.tokens!;
    rig.tokenStore.tokens = { ...before, accessToken: "stale" };
    await rig.client.session.restore();
    const { bots } = await rig.client.session.request<{ bots: unknown[] }>("GET", "/api/bots");
    expect(bots).toHaveLength(1);
    expect(rig.tokenStore.tokens!.refreshToken).not.toBe(before.refreshToken);
  });

  it("shares one renewal between parallel requests", async () => {
    rig.tokenStore.tokens = { ...rig.tokenStore.tokens!, accessToken: "stale" };
    await rig.client.session.restore();
    const replies = await Promise.all([1, 2, 3, 4].map(() => rig.client.session.request<{ bots: unknown[] }>("GET", "/api/bots")));
    expect(replies.every((reply) => reply.bots.length === 1)).toBe(true);
  });
});

describe("server state", () => {
  it("follows bots as they are created, changed, and deleted", async () => {
    const bot = await rig.client.createBot({ name: "Ledger" });
    await until(rig.client.server, (state) => state.bots.some((other) => other.id === bot.id));
    expect(rig.client.server.get().bots.map((other) => other.name)).toEqual(["Main", "Ledger"]);

    await rig.client.updateBot(bot.id, { name: "Atlas" });
    await until(rig.client.server, (state) => state.bots.some((other) => other.name === "Atlas"));

    await rig.client.deleteBot(bot.id);
    await until(rig.client.server, (state) => state.bots.length === 1);
  });
});

describe("bot list activity", () => {
  it("counts replies the owner hasn't seen, and clears them once a screen shows the chat", async () => {
    const bot = await rig.client.createBot({ name: "Courier", defaultModel: { provider: "script", modelId: "script-1" } });
    await rig.client.session.request("POST", `/api/bots/${bot.id}/chat/messages`, { text: "ping", mode: "send", requestId: "activity-1" });
    const unread = await until(rig.client.server, (state) => state.activity[bot.id]?.unread === 1);
    expect(unread.activity[bot.id]).toMatchObject({ preview: "echo: ping", lastAt: expect.any(Number) });

    const chat = rig.client.chat(bot.id);
    const unwatch = chat.watch();
    await until(rig.client.server, (state) => state.activity[bot.id]?.unread === 0);
    unwatch();
    await rig.client.deleteBot(bot.id);
  });
});

describe("signed-in devices", () => {
  it("lists this device, and signs another one out", async () => {
    const other = await rig.client.session.request<{ accessToken: string }>("POST", "/api/auth/login", { password: PASSWORD, deviceName: "Spare phone" });
    expect(other.accessToken).toBeTruthy();
    const sessions = await rig.client.sessions();
    expect(sessions.some((session) => session.current)).toBe(true);
    const spare = sessions.find((session) => session.deviceName === "Spare phone")!;
    await rig.client.revokeSession(spare.id);
    expect((await rig.client.sessions()).find((session) => session.id === spare.id)?.revokedAt).not.toBeNull();
  });
});

describe("model providers", () => {
  it("lists providers with the connected one marked, and its models", async () => {
    const providers = await rig.client.providers();
    expect(providers.find((provider) => provider.id === "script")).toMatchObject({ connected: true, connectedWith: "api_key" });
    expect(modelProblem(await rig.client.models(), { provider: "script", modelId: "script-1" })).toBeUndefined();
  });
});

describe("memory and notes", () => {
  it("saves the owner's memory edit", async () => {
    await rig.client.saveMemory(mainId, "USER_PROFILE.md", "Prefers short answers.");
    const memory = await rig.client.memory(mainId);
    expect(memory.files.find((file) => file.name === "USER_PROFILE.md")?.content).toBe("Prefers short answers.");
  });

  it("creates, finds, renames, and deletes a note", async () => {
    await rig.client.saveNote(mainId, "garden.md", "Tomatoes need staking in June.");
    expect((await rig.client.searchNotes(mainId, "tomatoes")).map((hit) => hit.name)).toEqual(["garden.md"]);
    await rig.client.saveNote(mainId, "vegetables.md", "Tomatoes need staking in June.", "garden.md");
    expect((await rig.client.notes(mainId)).map((note) => note.name)).toEqual(["vegetables.md"]);
    await rig.client.deleteNote(mainId, "vegetables.md");
    expect(await rig.client.notes(mainId)).toEqual([]);
    expect(newNoteName(["untitled.md"])).toBe("untitled-2.md");
    expect(noteNameProblem("../x.md")).toBeTruthy();
  });
});

describe("new bot", () => {
  it("lists connected models, and checks a folder before the bot is created", async () => {
    const models = await rig.client.models();
    expect(models.some((model) => model.provider === "script" && model.id === "script-1")).toBe(true);
    expect(suggestedModel(models, { provider: "script", modelId: "script-1" })).toEqual({ provider: "script", modelId: "script-1" });
    expect((await rig.client.freeSpace("")).allowed).toBe(true);
    const home = await rig.client.freeSpace("/");
    expect(home.allowed).toBe(false);
    expect(home.reason).toBeTruthy();
  });
});

describe("usage", () => {
  it("counts each reply once, by day and by bot", async () => {
    const bot = await rig.client.createBot({ name: "Meter", defaultModel: { provider: "script", modelId: "script-1" } });
    const before = await rig.client.usage(7);
    const chat = rig.client.chat(bot.id);
    const unwatch = chat.watch();
    await chat.send("count me");
    await until(chat.state, replied("echo: count me"));
    unwatch();
    const after = await rig.client.usage(7);
    const reply = chat.state.get().messages.find((message) => message.type === "assistant");
    const tokens = reply?.type === "assistant" ? reply.usage!.totalTokens : 0;
    expect(after.total.totalTokens - before.total.totalTokens).toBe(tokens);
    expect(after.bots.find((line) => line.botId === bot.id)?.usage.totalTokens).toBe(tokens);
    expect(after.days.at(-1)?.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await rig.client.deleteBot(bot.id);
  });
});

describe("alert settings", () => {
  it("starts with every kind on, and shares a change with every open app", async () => {
    const ready = await until(rig.client.server, (state) => state.alertSettings !== undefined);
    expect(Object.values(ready.alertSettings!).every(Boolean)).toBe(true);
    const settings = await rig.client.updateAlertSettings({ failure: false });
    expect(settings).toMatchObject({ failure: false, approval: true });
    await until(rig.client.server, (state) => state.alertSettings?.failure === false);
    await rig.client.updateAlertSettings({ failure: true });
  });
});

describe("chat actions", () => {
  const scriptModel = { provider: "script", modelId: "script-1" };

  it("clears the context, keeping earlier messages above a notice", async () => {
    const bot = await rig.client.createBot({ name: "Slate", defaultModel: scriptModel });
    const chat = rig.client.chat(bot.id);
    const unwatch = chat.watch();
    await chat.send("first");
    await until(chat.state, replied("echo: first"));
    await chat.clear();
    const state = await until(chat.state, (current) => current.messages.some((message) => message.type === "notice" && message.kind === "reset"));
    expect(state.messages.some((message) => message.type === "user" && message.text === "first")).toBe(true);
    unwatch();
    await rig.client.deleteBot(bot.id);
  });

  it("gives the bot its save turn, then compacts", async () => {
    const bot = await rig.client.createBot({ name: "Press", defaultModel: scriptModel });
    const chat = rig.client.chat(bot.id);
    const unwatch = chat.watch();
    // Long messages, so older ones can be summarized while recent ones stay verbatim.
    for (let index = 0; index < 4; index++) {
      await chat.send(`part${index} ${"lorem ipsum ".repeat(2700)}`);
      await until(chat.state, replied(`echo: part${index}`));
    }
    await chat.compact();
    await until(chat.state, (state) => state.messages.some((message) => message.type === "notice" && message.kind === "pre_compaction_save"));
    await until(chat.state, (state) => state.messages.some((message) => message.type === "notice" && message.kind === "compaction"), 20_000);
    unwatch();
    await rig.client.deleteBot(bot.id);
  });

  it("asks the model again after a reply failed", async () => {
    const bot = await rig.client.createBot({ name: "Relay", defaultModel: scriptModel });
    const chat = rig.client.chat(bot.id);
    const unwatch = chat.watch();
    scriptSwitches.failing = true;
    try {
      await chat.send("fail");
      await until(chat.state, (state) => state.live.failure !== null && !state.live.running);
    } finally {
      scriptSwitches.failing = false;
    }
    await chat.retryReply();
    const state = await until(chat.state, replied("echo: fail"));
    expect(state.live.failure).toBeNull();
    unwatch();
    await rig.client.deleteBot(bot.id);
  });
});

describe("chat", () => {
  it("shows a sent message as pending, then the reply, and offers the modes that fit", async () => {
    const chat = rig.client.chat(mainId);
    const unwatch = chat.watch();
    await until(chat.state, (state) => state.status === "ready");
    expect(offeredSendModes(chat.state.get().live)).toEqual(["send"]);

    const sending = chat.send("hello there");
    expect(chat.state.get().pending.map((send) => send.text)).toEqual(["hello there"]);
    await sending;
    const state = await until(chat.state, replied("echo: hello there"));
    expect(state.pending).toEqual([]);
    expect(state.messages.filter((message) => message.type === "user")).toHaveLength(1);
    await until(chat.state, (current) => current.totals.usage.totalTokens > 0);
    unwatch();
  });

  it("queues a message while the bot is busy, and stops a reply", async () => {
    const chat = rig.client.chat(mainId);
    const unwatch = chat.watch();
    await chat.send("slow 3000");
    const busy = await until(chat.state, (state) => state.live.running && state.live.streamingText.length > 0);
    expect(offeredSendModes(busy.live)).toEqual(["queue", "steer"]);

    await chat.send("after the reply");
    await until(chat.state, (state) => state.live.queued.some((queued) => queued.text === "after the reply") && state.pending.length === 0);

    await chat.stop();
    await until(chat.state, (state) => !state.live.running && state.live.queued.length === 0);
    unwatch();
  });

  it("offers earlier messages only when the chat has some", async () => {
    const bot = await rig.client.createBot({ name: "Talker", defaultModel: { provider: "script", modelId: "script-1" } });
    const chat = rig.client.chat(bot.id);
    let unwatch = chat.watch();
    expect((await until(chat.state, (state) => state.status === "ready")).hasEarlier).toBe(false);

    for (let turn = 0; turn < 30; turn += 1) {
      await chat.send(`turn ${turn}`);
      await until(chat.state, replied(`echo: turn ${turn}`));
    }
    unwatch();
    await until(rig.client.connection.status, (status) => status === "online");

    // A fresh snapshot holds the newest fifty messages of sixty, and the rest load on request.
    rig.sockets.at(-1)!.close();
    unwatch = chat.watch();
    const fresh = await until(chat.state, (state) => state.status === "ready" && state.messages.length === 50 && state.hasEarlier);
    expect(fresh.messages).toHaveLength(50);
    await chat.loadEarlier();
    const full = chat.state.get();
    expect(full.messages).toHaveLength(60);
    expect(full.hasEarlier).toBe(false);
    expect(full.messages[0]).toMatchObject({ type: "user", text: "turn 0" });
    unwatch();
  });

  it("follows the bot's default model while the chat has none of its own", async () => {
    const bot = await rig.client.createBot({ name: "Follower" });
    const chat = rig.client.chat(bot.id);
    const unwatch = chat.watch();
    await until(chat.state, (state) => state.status === "ready");
    expect(chat.state.get().settings.model).toBeNull();
    await rig.client.updateBot(bot.id, { defaultModel: { provider: "script", modelId: "script-1" } });
    await until(chat.state, (state) => state.settings.model?.modelId === "script-1");
    unwatch();
  });

  it("marks a send that fails, and sends it again on retry", async () => {
    const bot = await rig.client.createBot({ name: "Modelless" });
    const chat = rig.client.chat(bot.id);
    const unwatch = chat.watch();
    await chat.send("hello");
    const failed = chat.state.get().pending[0]!;
    expect(failed.failed).toContain("Choose a model");

    await rig.client.updateBot(bot.id, { defaultModel: { provider: "script", modelId: "script-1" } });
    await chat.retry(failed.requestId);
    await until(chat.state, replied("echo: hello"));
    expect(chat.state.get().pending).toEqual([]);
    unwatch();
  });

  it("lists an approval under what needs the owner, and clears it once answered", async () => {
    const chat = rig.client.chat(mainId);
    const unwatch = chat.watch();
    await chat.send('tool read {"path":"/etc/hostname"}');
    const waiting = await until(rig.client.server, (state) => state.approvals.length === 1);
    expect(waiting.approvals[0]).toMatchObject({ toolName: "read", botId: mainId });

    await rig.client.answerApproval(waiting.approvals[0]!.id, "allow_once");
    await until(rig.client.server, (state) => state.approvals.length === 0);
    await until(chat.state, (state) => state.messages.some((message) => message.type === "tool_result" && message.toolName === "read") && !state.live.running);
    unwatch();
  });
});

describe("alerts", () => {
  it("hears an approval on the alerts stream, worded with the bot's name", async () => {
    const bot = await rig.client.createBot({ name: "Herald", defaultModel: { provider: "script", modelId: "script-1" } });
    const heard: Alert[] = [];
    const stop = rig.client.followAlerts((alert) => heard.push(alert));
    await new Promise((resolve) => setTimeout(resolve, 300));
    await rig.client.session.request("POST", `/api/bots/${bot.id}/chat/messages`, { text: 'tool read {"path":"/etc/hostname"}', mode: "send" });
    const waiting = await until(rig.client.server, (state) => state.approvals.some((approval) => approval.botId === bot.id));
    const deadline = Date.now() + 5_000;
    while (!heard.some((alert) => alert.botId === bot.id) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
    stop();
    const alert = heard.find((item) => item.botId === bot.id)!;
    expect(alert.kind).toBe("approval");
    expect(alertText(alert, rig.client.server.get().bots).body).toBe("Herald needs your approval");
    await rig.client.answerApproval(waiting.approvals.find((approval) => approval.botId === bot.id)!.id, "deny");
    await rig.client.deleteBot(bot.id);
  });
});

describe("background alerts", () => {
  it("starts with an alerts-only token, sends bot names, and stops when turned off or signed out", async () => {
    const calls: string[] = [];
    let enabled = true;
    let token = "";
    let names: Record<string, string> = {};
    const service: BackgroundAlertsService = {
      isEnabled: async () => enabled,
      start: async (_server, value) => void ((token = value), calls.push("start")),
      stop: async () => void calls.push("stop"),
      setEnabled: async (value) => void (enabled = value),
      setBotNames: async (value) => void (names = value),
      status: async () => ({ running: false, connected: false, notificationsAllowed: null, batteryUnrestricted: null, maker: null }),
    };
    const background = new BackgroundAlerts(service);
    await background.connect(rig.client);
    expect(calls).toEqual(["start"]);
    expect(token.startsWith("alerts.")).toBe(true);
    expect(names[mainId]).toBe("Main");

    await background.setKeepConnected(false);
    expect(calls).toEqual(["start", "stop"]);
    expect(enabled).toBe(false);
    await background.disconnect();
    expect(calls.at(-1)).toBe("stop");
  });
});

describe("local cache", () => {
  it("saves the server state and a chat on the device, then shows them before the next snapshot, and forgets them on sign-out", async () => {
    const entries = new Map<string, string>();
    const cache: LocalCache = { get: async (key) => entries.get(key), set: async (key, value) => void entries.set(key, value), clear: async () => entries.clear() };
    const tokens = memoryTokenStore();
    const login = await rig.client.session.request<Tokens>("POST", "/api/auth/login", { password: PASSWORD, deviceName: "Cached" });
    await tokens.save(login);
    const make = () => new BotsmanClient({ baseUrl: rig.server.baseUrl, fetch: proxiedFetch, createSocket: (url) => new WebSocket(url, { headers: { "x-forwarded-proto": "https" } } as unknown as string[]) as unknown as SocketLike, deviceName: "Cached", tokenStore: tokens, cache });

    const first = make();
    await first.session.restore();
    const unwatch = first.chat(mainId).watch();
    await until(first.chat(mainId).state, (state) => state.status === "ready");
    await new Promise((resolve) => setTimeout(resolve, 1_300));
    unwatch();
    first.connection.stop();
    expect([...entries.keys()].some((key) => key.endsWith("|server"))).toBe(true);
    expect([...entries.keys()].some((key) => key.endsWith(`|chat:${mainId}`))).toBe(true);

    const second = make();
    const chat = second.chat(mainId);
    await until(chat.state, (state) => state.status === "cached");
    expect(chat.state.get().messages.length).toBeGreaterThan(0);
    await second.session.signOut();
    expect(entries.size).toBe(0);
  });
});

describe("reconnect", () => {
  it("catches up on what it missed while the socket was down", async () => {
    const chat = rig.client.chat(mainId);
    const unwatch = chat.watch();
    await until(chat.state, (state) => state.status === "ready" && !state.live.running);
    const before = chat.state.get().messages.length;

    rig.sockets.at(-1)!.close();
    await until(rig.client.connection.status, (status) => status === "reconnecting");
    await rig.client.session.request("POST", `/api/bots/${mainId}/chat/messages`, { text: "while away" });

    await until(rig.client.connection.status, (status) => status === "online");
    const state = await until(chat.state, replied("echo: while away"));
    const ids = state.messages.map((message) => message.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(state.messages.length).toBeGreaterThan(before);
    unwatch();
  });

  it("goes offline on sign-out, and signs in again with the password", async () => {
    await rig.client.session.signOut();
    expect(rig.client.session.state.get()).toEqual({ status: "signed_out" });
    expect(rig.client.connection.status.get()).toBe("offline");
    expect(rig.tokenStore.tokens).toBeUndefined();

    await rig.client.session.signIn(PASSWORD);
    await until(rig.client.server, (state) => state.status === "ready");
    expect(rig.client.server.get().bots.length).toBeGreaterThan(0);
  });
});

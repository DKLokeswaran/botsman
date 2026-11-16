import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ChatState, offeredSendModes } from "../src/index.ts";
import { PASSWORD, type Rig, startRig, until } from "./real-server.ts";

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

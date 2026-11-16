import { ALERTS_STREAM } from "../../src/services.ts";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chatStream } from "@botsman/protocol";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scriptModelProvider } from "../../src/testing/script-model.ts";
import { BotsmanClient, HttpError, type StreamClient } from "../e2e/client.ts";
import { PASSWORD, SCRIPT_MODEL_REF, setUpServer, startTestServer, type TestServer } from "../helpers.ts";

let server: TestServer;
let mainId: string;

beforeAll(async () => {
  server = await startTestServer();
  mainId = await setUpServer(server);
});

afterAll(async () => {
  await server?.botsman.stop();
  server?.root.cleanup();
});

async function openChat(botId: string): Promise<{ stream: StreamClient; chat: string }> {
  const stream = await server.client.stream();
  const chat = chatStream(botId);
  stream.subscribe(chat);
  await stream.waitFor((message) => message.type === "snapshot" && message.stream === chat);
  return { stream, chat };
}

async function expectError(promise: Promise<unknown>, status: number, code: string): Promise<void> {
  const error = await promise.then(() => undefined, (caught: unknown) => caught);
  expect(error).toBeInstanceOf(HttpError);
  expect((error as HttpError).status).toBe(status);
  expect((error as HttpError).body?.error).toBe(code);
}

describe("auth and exposure", () => {
  it("refuses plain HTTP", async () => {
    const response = await server.client.raw("GET", "/api/health", undefined, { "x-forwarded-proto": "http" });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "https_required" });
  });

  it("says so when the dashboard is not built", async () => {
    const response = await server.client.raw("GET", "/app/");
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: "dashboard_missing" });
  });

  it("serves the dashboard's files, and its page for any other path", async () => {
    const dashboard = path.join(server.root.root, "dashboard");
    mkdirSync(path.join(dashboard, "assets"), { recursive: true });
    writeFileSync(path.join(dashboard, "index.html"), "<html>dashboard</html>");
    writeFileSync(path.join(dashboard, "assets", "app-abc123.js"), "console.log(1)");

    const script = await server.client.raw("GET", "/app/assets/app-abc123.js");
    expect(await script.text()).toBe("console.log(1)");
    expect(script.headers.get("content-type")).toContain("text/javascript");
    expect(script.headers.get("cache-control")).toContain("immutable");

    for (const url of ["/app/", "/app/chat/main", "/app/assets/missing.js"]) {
      const page = await server.client.raw("GET", url);
      expect(await page.text()).toBe("<html>dashboard</html>");
      expect(page.headers.get("content-security-policy")).toContain("default-src 'self'");
      expect(page.headers.get("cache-control")).toBe("no-cache");
    }
  });

  it("keeps dashboard requests inside the dashboard folder", async () => {
    writeFileSync(path.join(server.root.root, "outside.txt"), "kept-outside");
    for (const url of ["/app/..%2Foutside.txt", "/app/%2e%2e/outside.txt", "/app/..%5Coutside.txt"]) {
      const response = await server.client.raw("GET", url);
      expect(await response.text()).not.toContain("kept-outside");
    }
  });

  it("sends the bare address to the dashboard", async () => {
    const response = await fetch(`${server.baseUrl}/`, { redirect: "manual", headers: { "x-forwarded-proto": "https" } });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/app/");
  });

  it("refuses a second setup and private routes without a token", async () => {
    await expectError(server.client.request("POST", "/api/setup", { password: PASSWORD, deviceName: "x", mainBot: { name: "Again" } }), 409, "already_set_up");
    const anonymous = await fetch(`${server.baseUrl}/api/bots`, { headers: { "x-forwarded-proto": "https" } });
    expect(anonymous.status).toBe(401);
  });

  it("rotates refresh tokens and revokes sessions", async () => {
    const first = await server.client.login(PASSWORD);
    const second = await server.client.request<{ refreshToken: string; accessToken: string }>("POST", "/api/auth/refresh", { refreshToken: first.refreshToken });
    await expectError(server.client.request("POST", "/api/auth/refresh", { refreshToken: first.refreshToken }), 401, "unauthorized");
    server.client.tokens = { ...first, ...second } as typeof first;
    await server.client.request("POST", "/api/auth/logout");
    await expectError(server.client.bots(), 401, "unauthorized");
    await server.client.login(PASSWORD);
  });

  it("rate-limits password guesses", async () => {
    const results: number[] = [];
    for (let attempt = 0; attempt < 12; attempt++) {
      results.push((await server.client.raw("POST", "/api/auth/login", { password: "wrong", deviceName: "x" })).status);
    }
    expect(results).toContain(429);
  });

  it("caps password guesses overall, so a faked X-Forwarded-For can't pose as many addresses", async () => {
    const other = await startTestServer();
    await setUpServer(other);
    const results: number[] = [];
    for (let attempt = 0; attempt < 32; attempt++) {
      const response = await other.client.raw("POST", "/api/auth/login", { password: "wrong", deviceName: "x" }, { "x-forwarded-for": `10.0.0.${attempt}` });
      results.push(response.status);
    }
    expect(results.slice(0, 30)).not.toContain(429);
    expect(results.slice(30)).toEqual([429, 429]);
    await other.botsman.stop();
    other.root.cleanup();
  });

  it("counts parallel guesses before checking them, and never counts a correct password", async () => {
    const other = await startTestServer();
    await setUpServer(other);
    for (let attempt = 0; attempt < 12; attempt++) await other.client.login(PASSWORD);
    const guess = () => other.client.raw("POST", "/api/auth/login", { password: "wrong", deviceName: "x" }).then((response) => response.status);
    const statuses = await Promise.all(Array.from({ length: 20 }, guess));
    expect(statuses.filter((status) => status === 401)).toHaveLength(10);
    expect(statuses.filter((status) => status === 429)).toHaveLength(10);
    await other.botsman.stop();
    other.root.cleanup();
  });

  it("closes a WebSocket that sends a message over 64 KiB", async () => {
    const socket = new WebSocket(`${server.baseUrl.replace("http", "ws")}/api/ws`, { headers: { "x-forwarded-proto": "https" } } as unknown as string[]);
    await new Promise((resolve) => (socket.onopen = resolve));
    const closed = new Promise<number>((resolve) => (socket.onclose = (event) => resolve(event.code)));
    socket.send("x".repeat(70 * 1024));
    expect(await closed).toBe(1009);
  });
});

describe("dashboard sign-in with cookies", () => {
  // Its own server, so the sign-in limits other tests use up don't apply here.
  let server: TestServer;
  let mainId: string;
  beforeAll(async () => {
    server = await startTestServer();
    mainId = await setUpServer(server);
  });
  afterAll(async () => {
    await server.botsman.stop();
    server.root.cleanup();
  });

  const origin = () => ({ origin: server.baseUrl });
  const cookiesOf = (response: Response) => response.headers.getSetCookie().map((line) => line.split(";")[0]!).join("; ");
  const signIn = () => server.client.raw("POST", "/api/auth/login", { password: PASSWORD, deviceName: "browser", cookie: true }, origin());

  it("keeps the tokens in cookies that page scripts can't read", async () => {
    const response = await signIn();
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["accessExpiresAt", "refreshExpiresAt", "sessionId"]);
    const lines = response.headers.getSetCookie();
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(line).toMatch(/HttpOnly; Secure; SameSite=Strict$/);
    expect(lines.find((line) => line.startsWith("botsman_refresh="))).toContain("Path=/api/auth;");
  });

  it("refuses a cookie sign-in that another site started", async () => {
    const noOrigin = await server.client.raw("POST", "/api/auth/login", { password: PASSWORD, deviceName: "browser", cookie: true });
    const otherSite = await server.client.raw("POST", "/api/auth/login", { password: PASSWORD, deviceName: "browser", cookie: true }, { origin: "https://evil.example" });
    expect([noOrigin.status, otherSite.status]).toEqual([403, 403]);
  });

  it("reads with the cookie, and changes things only from the dashboard's own pages", async () => {
    const cookie = cookiesOf(await signIn());
    const anonymous = new BotsmanClient(server.baseUrl);
    expect((await anonymous.raw("GET", "/api/bots", undefined, { cookie })).status).toBe(200);
    expect((await anonymous.raw("PATCH", `/api/bots/${mainId}`, { description: "x" }, { cookie })).status).toBe(403);
    expect((await anonymous.raw("PATCH", `/api/bots/${mainId}`, { description: "x" }, { cookie, origin: "https://evil.example" })).status).toBe(403);
    expect((await anonymous.raw("PATCH", `/api/bots/${mainId}`, { description: "" }, { cookie, ...origin() })).status).toBe(200);
  });

  it("renews the cookies, and the old refresh cookie stops working", async () => {
    const anonymous = new BotsmanClient(server.baseUrl);
    const first = cookiesOf(await signIn());
    const renewed = await anonymous.raw("POST", "/api/auth/refresh", {}, { cookie: first, ...origin() });
    expect(renewed.status).toBe(200);
    expect(renewed.headers.getSetCookie()).toHaveLength(2);
    expect((await anonymous.raw("POST", "/api/auth/refresh", {}, { cookie: first, ...origin() })).status).toBe(401);
    expect((await anonymous.raw("POST", "/api/auth/refresh", {}, { cookie: cookiesOf(renewed) })).status).toBe(403);
  });

  it("clears the cookies on sign-out", async () => {
    const cookie = cookiesOf(await signIn());
    const anonymous = new BotsmanClient(server.baseUrl);
    const response = await anonymous.raw("POST", "/api/auth/logout", undefined, { cookie, ...origin() });
    expect(response.headers.getSetCookie().every((line) => line.includes("Max-Age=0"))).toBe(true);
    expect((await anonymous.raw("GET", "/api/bots", undefined, { cookie })).status).toBe(401);
  });

  it("opens the socket with the cookie, but only from the dashboard's own pages", async () => {
    const cookie = cookiesOf(await signIn());
    const open = async (headers: Record<string, string>) => {
      const socket = new WebSocket(`${server.baseUrl.replace(/^http/, "ws")}/api/ws`, { headers: { "x-forwarded-proto": "https", cookie, ...headers } } as unknown as string[]);
      await new Promise<void>((resolve, reject) => ((socket.onopen = () => resolve()), (socket.onerror = () => reject(new Error("socket failed")))));
      const reply = new Promise<string>((resolve) => (socket.onmessage = (event) => resolve(JSON.parse(String(event.data)).type)));
      socket.send(JSON.stringify({ type: "hello", token: "" }));
      const type = await reply;
      socket.close();
      return type;
    };
    expect(await open(origin())).toBe("ready");
    expect(await open({ origin: "https://evil.example" })).toBe("error");
  });
});

describe("bots", () => {
  it("refuses unsafe folders and duplicate names", async () => {
    await expectError(server.client.createBot({ name: "Bad", folder: server.root.home }), 400, "unsafe_folder");
    await expectError(server.client.createBot({ name: "main" }), 409, "conflict");
  });

  it("deletes a bot but never the main bot, and frees its name", async () => {
    const bot = await server.client.createBot({ name: "Temp", purpose: "Temporary" });
    await expectError(server.client.request("DELETE", `/api/bots/${mainId}`), 403, "forbidden");
    await server.client.request("DELETE", `/api/bots/${bot.id}`);
    expect((await server.client.bots()).bots.map((item) => item.id)).not.toContain(bot.id);
    await server.client.createBot({ name: "Temp" });
  });

  it("refuses to chat without a connected model", async () => {
    const bot = await server.client.createBot({ name: "No model" });
    await expectError(server.client.send(bot.id, "hi"), 409, "model_not_connected");
  });
});

describe("approvals", () => {
  it("refuses when the owner denies, and tells the bot", async () => {
    const bot = await server.client.createBot({ name: "Denied", defaultModel: SCRIPT_MODEL_REF });
    const { stream, chat } = await openChat(bot.id);
    await server.client.send(bot.id, 'tool read {"path":"/etc/hostname"}');
    const live = await stream.waitForLive(chat, (state) => state.tools.some((tool) => tool.awaitingApproval !== null));
    await server.client.answerApproval(live.tools[0]!.awaitingApproval!, "deny");
    const result = await stream.waitForMessage(chat, (message) => message.type === "tool_result");
    expect(result).toMatchObject({ isError: true, output: expect.stringContaining("denied") });
    stream.close();
  });

  it("refuses an unanswered approval once the wait runs out", async () => {
    const bot = await server.client.createBot({ name: "Waiter", defaultModel: SCRIPT_MODEL_REF });
    server.botsman.services.db.prepare("UPDATE bots SET approval_wait_ms = 300 WHERE id = ?").run(bot.id);
    const { stream, chat } = await openChat(bot.id);
    await server.client.send(bot.id, 'tool read {"path":"/etc/hostname"}');
    const result = await stream.waitForMessage(chat, (message) => message.type === "tool_result");
    expect(result).toMatchObject({ isError: true, output: expect.stringContaining("did not answer") });
    expect((await server.client.approvals("expired")).approvals.some((approval) => approval.botId === bot.id)).toBe(true);
    stream.close();
  });

  it("allow for this chat covers later calls of that tool", async () => {
    const bot = await server.client.createBot({ name: "Granted", defaultModel: SCRIPT_MODEL_REF });
    const { stream, chat } = await openChat(bot.id);
    await server.client.send(bot.id, 'tool read {"path":"/etc/hostname"}');
    const live = await stream.waitForLive(chat, (state) => state.tools.some((tool) => tool.awaitingApproval !== null));
    await server.client.answerApproval(live.tools[0]!.awaitingApproval!, "allow_chat");
    await stream.waitForMessage(chat, (message) => message.type === "tool_result");
    await server.client.send(bot.id, 'tool read {"path":"/etc/os-release"}');
    await stream.waitForMessage(chat, (message) => message.type === "tool_result" && message.output.includes("NAME"));
    expect((await server.client.approvals()).approvals.filter((approval) => approval.botId === bot.id)).toHaveLength(0);
    stream.close();
  });

  it("smart mode runs like off for now, without asking", async () => {
    const bot = await server.client.createBot({ name: "Smart", defaultModel: SCRIPT_MODEL_REF });
    await server.client.updateBot(bot.id, { permissionMode: "smart" });
    const { stream, chat } = await openChat(bot.id);
    await server.client.send(bot.id, 'tool read {"path":"/etc/hostname"}');
    const result = await stream.waitForMessage(chat, (message) => message.type === "tool_result");
    expect(result).toMatchObject({ isError: false });
    expect((await server.client.approvals()).approvals.filter((approval) => approval.botId === bot.id)).toHaveLength(0);
    stream.close();
  });
});

describe("memory", () => {
  it("lets only the main bot edit USER_MEMORY.md, and no bot a PROFILE file, without asking the owner first", async () => {
    const bot = await server.client.createBot({ name: "Plain", defaultModel: SCRIPT_MODEL_REF });
    const { stream, chat } = await openChat(bot.id);
    await server.client.send(bot.id, 'tool memory {"action":"edit_memory","file":"USER_MEMORY.md","content":"x"}');
    const refused = await stream.waitForMessage(chat, (message) => message.type === "tool_result");
    expect(refused).toMatchObject({ isError: true, output: expect.stringContaining("Only the main bot") });
    expect((await server.client.approvals()).approvals.filter((approval) => approval.botId === bot.id)).toHaveLength(0);
    stream.close();

    const main = await openChat(mainId);
    await server.client.send(mainId, 'tool memory {"action":"edit_memory","file":"USER_MEMORY.md","content":"Owner lives in Chennai.","reason":"The owner said so"}');
    const live = await main.stream.waitForLive(main.chat, (state) => state.tools.some((tool) => tool.awaitingApproval !== null));
    const approval = (await server.client.approvals()).approvals.find((candidate) => candidate.id === live.tools[0]!.awaitingApproval)!;
    expect(approval).toMatchObject({ reason: "The owner said so", memoryEdit: { file: "USER_MEMORY.md", content: "Owner lives in Chennai.", previous: "" } });
    await server.client.answerApproval(approval.id, "allow_once");
    const result = await main.stream.waitForMessage(main.chat, (message) => message.type === "tool_result" && message.toolName === "memory");
    expect(result).toMatchObject({ isError: false, output: expect.stringContaining("USER_MEMORY.md now holds") });
    main.stream.close();
  });

  it("refuses an edit with no content before asking the owner", async () => {
    const bot = await server.client.createBot({ name: "No content", defaultModel: SCRIPT_MODEL_REF });
    const { stream, chat } = await openChat(bot.id);
    await server.client.send(bot.id, 'tool memory {"action":"edit_memory","file":"BOT_MEMORY.md"}');
    const result = await stream.waitForMessage(chat, (message) => message.type === "tool_result");
    expect(result).toMatchObject({ isError: true, output: expect.stringContaining("content field is required") });
    expect((await server.client.approvals()).approvals.filter((approval) => approval.botId === bot.id)).toHaveLength(0);
    stream.close();
  });

  it("refuses an edit over the file's limit with the current usage", async () => {
    const { stream, chat } = await openChat(mainId);
    const content = "x".repeat(4100);
    await server.client.send(mainId, `tool memory {"action":"edit_memory","content":"${content}"}`);
    const result = await stream.waitForMessage(chat, (message) => message.type === "tool_result" && message.isError);
    expect(result).toMatchObject({ output: expect.stringContaining("limited to 4000 characters") });
    stream.close();
  });

  it("asks even in off mode, never allows a memory edit for the whole chat, and leaves the file unchanged when denied", async () => {
    const bot = await server.client.createBot({ name: "Denied edit", defaultModel: SCRIPT_MODEL_REF });
    await server.client.updateBot(bot.id, { permissionMode: "off" });
    const { stream, chat } = await openChat(bot.id);
    await server.client.send(bot.id, 'tool memory {"action":"edit_memory","content":"Likes long answers."}');
    const live = await stream.waitForLive(chat, (state) => state.tools.some((tool) => tool.awaitingApproval !== null));
    const approvalId = live.tools[0]!.awaitingApproval!;
    await expectError(server.client.answerApproval(approvalId, "allow_chat"), 400, "bad_request");
    await server.client.answerApproval(approvalId, "deny");
    const result = await stream.waitForMessage(chat, (message) => message.type === "tool_result");
    expect(result).toMatchObject({ isError: true, output: expect.stringContaining("denied") });
    expect((await server.client.memory(bot.id)).files.find((file) => file.name === "BOT_MEMORY.md")!.content).toBe("");
    stream.close();
  });

  it("sends memory changes with the bot's next message, not shown in chat", async () => {
    const bot = await server.client.createBot({ name: "Rememberer", defaultModel: SCRIPT_MODEL_REF });
    const { stream, chat } = await openChat(bot.id);
    await server.client.send(bot.id, "first");
    await stream.waitForMessage(chat, (message) => message.type === "assistant" && message.text === "echo: first");
    await server.client.request("PUT", `/api/bots/${bot.id}/memory/USER_PROFILE.md`, { content: "The owner is Lokes." });
    await server.client.send(bot.id, "second");
    await stream.waitForMessage(chat, (message) => message.type === "assistant" && message.text === "echo: second");

    const view = await server.botsman.services.engine.view(server.botsman.services.registry.get(bot.id)!);
    const sent = view.entries.filter((entry) => entry.kind === "botsman.owner-message").at(-1)!;
    const modelText = JSON.stringify(sent.model);
    expect(modelText).toContain("USER_PROFILE.md changed");
    expect(modelText).toContain("The owner is Lokes.");
    expect(stream.messages.get(chat)!.filter((message) => message.type === "user").at(-1)).toMatchObject({ text: "second" });
    stream.close();
  });
});

describe("saving before compaction", () => {
  let small: TestServer;

  beforeAll(async () => {
    const root = (await import("../helpers.ts")).tempRoot();
    const { startBotsman } = await import("../../src/server.ts");
    const { testConfig } = await import("../helpers.ts");
    const provider = scriptModelProvider({ provider: "script-small", contextWindow: 60_000 }).provider;
    const botsman = await startBotsman(testConfig(root.home, root.dataDir, root.root), { backups: false, log: () => {}, extraProviders: [{ provider, methods: ["api_key"] }] });
    const { port } = botsman.http.server.address() as { port: number };
    const { BotsmanClient } = await import("../e2e/client.ts");
    small = { botsman, client: new BotsmanClient(`http://127.0.0.1:${port}`), baseUrl: "", root };
  });

  afterAll(async () => {
    await small?.botsman.stop();
    small?.root.cleanup();
  });

  it("gives the bot a turn to save, then compacts", async () => {
    await small.client.setup(PASSWORD, { name: "Main", defaultModel: { provider: "script-small", modelId: "script-1" } });
    await small.client.saveKey("script-small", "test-key");
    const botId = (await small.client.bots()).bots[0]!.id;
    const stream = await small.client.stream();
    const chat = chatStream(botId);
    stream.subscribe(chat);
    await stream.waitFor((message) => message.type === "snapshot");
    // Several long messages, so older ones can be summarized while recent ones stay verbatim.
    for (let index = 0; index < 4; index++) {
      await small.client.send(botId, `part${index} ${"lorem ipsum ".repeat(2700)}`);
      await stream.waitForMessage(chat, (message) => message.type === "assistant" && message.text.startsWith(`echo: part${index}`), 20_000);
    }
    await stream.waitForMessage(chat, (message) => message.type === "notice" && message.kind === "pre_compaction_save", 20_000);
    await stream.waitForMessage(chat, (message) => message.type === "notice" && message.kind === "compaction", 20_000);
    const kinds = stream.messages.get(chat)!.map((message) => (message.type === "notice" ? message.kind : message.type));
    expect(kinds.indexOf("pre_compaction_save")).toBeLessThan(kinds.indexOf("compaction"));
    stream.close();
  });
});

describe("alerts stream", () => {
  it("alerts on an approval and replays missed alerts after a reconnect", async () => {
    const socket = new WebSocket(`${server.baseUrl.replace("http", "ws")}/api/alerts`, { headers: { "x-forwarded-proto": "https" } } as unknown as string[]);
    const received: { type: string; seq?: number; epoch?: string; alert?: { kind: string } }[] = [];
    socket.onmessage = (event) => received.push(JSON.parse(String(event.data)));
    await new Promise((resolve) => (socket.onopen = resolve));
    socket.send(JSON.stringify({ type: "hello", token: server.client.tokens!.accessToken, epoch: "unknown", seq: 0 }));
    const bot = await server.client.createBot({ name: "Alerter", defaultModel: SCRIPT_MODEL_REF });
    await server.client.send(bot.id, 'tool read {"path":"/etc/hostname"}');
    const deadline = Date.now() + 10_000;
    while (!received.some((message) => message.alert?.kind === "approval") && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
    const reset = received.find((message) => message.type === "reset")!;
    const alert = received.find((message) => message.alert?.kind === "approval")!;
    expect(reset).toBeDefined();
    expect(alert.seq).toBeGreaterThan(0);
    socket.close();

    const again = new WebSocket(`${server.baseUrl.replace("http", "ws")}/api/alerts`, { headers: { "x-forwarded-proto": "https" } } as unknown as string[]);
    const replayed: { type: string; seq?: number }[] = [];
    again.onmessage = (event) => replayed.push(JSON.parse(String(event.data)));
    await new Promise((resolve) => (again.onopen = resolve));
    again.send(JSON.stringify({ type: "hello", token: server.client.tokens!.accessToken, epoch: alert.epoch, seq: alert.seq! - 1 }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(replayed[0]).toMatchObject({ type: "alert", seq: alert.seq });
    again.close();
    await server.client.stop(bot.id);
  });

  it("leaves a kind the owner turned off out of the stream", async () => {
    const { alerts } = server.botsman.services;
    await server.client.request("PATCH", "/api/settings/alerts", { approval: false });
    const before = alerts.currentSeq(ALERTS_STREAM);
    const bot = await server.client.createBot({ name: "Quiet", defaultModel: SCRIPT_MODEL_REF });
    await server.client.send(bot.id, 'tool read {"path":"/etc/hostname"}');
    const deadline = Date.now() + 10_000;
    while ((await server.client.approvals()).approvals.every((approval) => approval.botId !== bot.id) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
    expect((await server.client.approvals()).approvals.some((approval) => approval.botId === bot.id)).toBe(true);
    expect(alerts.currentSeq(ALERTS_STREAM)).toBe(before);
    await server.client.request("PATCH", "/api/settings/alerts", { approval: true });
    await server.client.stop(bot.id);
  });
});

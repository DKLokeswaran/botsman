import { chatStream, type ChatMessage } from "@botsman/protocol";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { STREAM_INTERVAL_MS } from "../../src/events/chat-feed.ts";
import { setUpServer, startTestServer, type TestServer } from "../helpers.ts";
import type { StreamClient } from "./client.ts";

// The M1 "done when" scenario, end to end over HTTP and the WebSocket, against the scripted model.
describe("M1 scenario", () => {
  let server: TestServer;
  let botId: string;
  let stream: StreamClient;
  let chat: string;

  beforeAll(async () => {
    server = await startTestServer();
    botId = await setUpServer(server);
    chat = chatStream(botId);
    stream = await server.client.stream();
    stream.subscribe(chat);
    await stream.waitFor((message) => message.type === "snapshot" && message.stream === chat);
  });

  afterAll(async () => {
    stream?.close();
    await server?.botsman.stop();
    server?.root.cleanup();
  });

  it("streams a reply", async () => {
    const sent = await server.client.send(botId, "hello there");
    expect(sent.placed).toBe("started");
    const reply = await stream.waitForMessage(chat, (message) => message.type === "assistant" && message.text === "echo: hello there");
    expect(reply.type === "assistant" && reply.usage?.totalTokens).toBeGreaterThan(0);
    const user = stream.messages.get(chat)!.find((message) => message.type === "user");
    expect(user).toMatchObject({ text: "hello there" });
  });

  it("sends streamed text at most once per interval, since each update carries the whole reply so far", async () => {
    const from = stream.received.length;
    const started = Date.now();
    await server.client.send(botId, "slow 400");
    await stream.waitForMessage(chat, (message) => message.type === "assistant" && message.text.endsWith("word399"));
    const elapsed = Date.now() - started;
    const streamed = stream.received.slice(from).filter((message) => message.type === "event" && message.stream === chat && message.event.type === "live" && message.event.live.streamingText !== "");
    expect(streamed.length).toBeGreaterThan(0);
    expect(streamed.length).toBeLessThanOrEqual(elapsed / STREAM_INTERVAL_MS + 2);
  });

  it("stops a reply", async () => {
    await server.client.send(botId, "slow 3000");
    await stream.waitForLive(chat, (live) => live.streamingText.length > 0);
    await server.client.stop(botId);
    const live = await stream.waitForLive(chat, (state) => !state.running);
    expect(live.running).toBe(false);
  });

  it("queues and steers while a reply runs", async () => {
    await server.client.send(botId, "slow 400");
    await stream.waitForLive(chat, (live) => live.running);
    const queued = await server.client.send(botId, "after the reply", "queue");
    expect(queued.placed).toBe("queued");
    const steered = await server.client.send(botId, "steer note", "steer");
    expect(steered.placed).toBe("steered");
    // With no tool round to join, the steer lands with the queued message once the reply ends, and both get one answer.
    await stream.waitForMessage(chat, (message) => message.type === "assistant" && message.text === "echo: steer note");
    const texts = stream.messages.get(chat)!.map((message) => ("text" in message ? message.text : ""));
    expect(texts.indexOf("after the reply")).toBeGreaterThan(texts.indexOf("slow 400"));
    expect(texts.indexOf("steer note")).toBeGreaterThan(texts.indexOf("after the reply"));
  });

  it("catches up after a reconnect", async () => {
    const position = stream.positions.get(chat)!;
    stream.close();
    await server.client.send(botId, "while away");
    await new Promise((resolve) => setTimeout(resolve, 500));
    const again = await server.client.stream();
    again.positions.set(chat, position);
    again.subscribe(chat, true);
    const catchup = await again.waitFor((message) => message.type === "catchup" && message.stream === chat);
    const caught = catchup.type === "catchup" ? catchup.events.map((item) => item.event) : [];
    expect(caught.some((event) => event.type === "message" && (event.message as ChatMessage).type === "user")).toBe(true);
    expect(catchup.type === "catchup" && catchup.events[0]!.seq).toBe(position.seq + 1);
    stream = again;
    stream.messages.set(chat, []);
  });

  it("asks before a tool leaves the bot's folder, and runs it once allowed", async () => {
    await server.client.send(botId, 'tool read {"path":"/etc/hostname"}');
    const live = await stream.waitForLive(chat, (state) => state.tools.some((tool) => tool.awaitingApproval !== null));
    const approvalId = live.tools.find((tool) => tool.awaitingApproval)!.awaitingApproval!;
    const { approvals } = await server.client.approvals();
    expect(approvals.find((approval) => approval.id === approvalId)).toMatchObject({ toolName: "read", status: "pending" });
    await server.client.answerApproval(approvalId, "allow_once");
    const result = await stream.waitForMessage(chat, (message) => message.type === "tool_result" && message.toolName === "read");
    expect(result).toMatchObject({ isError: false });
  });

  it("runs shell commands inside the folder without asking", async () => {
    await server.client.send(botId, 'tool bash {"command":"echo sandboxed > proof.txt && cat proof.txt"}');
    const result = await stream.waitForMessage(chat, (message) => message.type === "tool_result" && message.toolName === "bash");
    expect(result).toMatchObject({ isError: false, output: expect.stringContaining("sandboxed") });
  });

  it("edits a memory file once the owner allows it", async () => {
    await server.client.send(botId, 'tool memory {"action":"edit_memory","content":"The owner likes tea.","reason":"Owner said so"}');
    const live = await stream.waitForLive(chat, (state) => state.tools.some((tool) => tool.awaitingApproval !== null));
    await server.client.answerApproval(live.tools[0]!.awaitingApproval!, "allow_once");
    const result = await stream.waitForMessage(chat, (message) => message.type === "tool_result" && message.toolName === "memory");
    expect(result).toMatchObject({ isError: false, output: expect.stringContaining("approved") });
    const memory = await server.client.memory(botId);
    expect(memory.files.find((file) => file.name === "BOT_MEMORY.md")!.content).toBe("The owner likes tea.");
  });

  it("writes and searches notes", async () => {
    await server.client.send(botId, 'tool notes {"action":"write_note","name":"projects.md","content":"Botsman server milestone one is underway"}');
    await stream.waitForMessage(chat, (message) => message.type === "tool_result" && message.output.includes("Saved projects.md"));
    const { hits } = await server.client.searchNotes(botId, "milestone");
    expect(hits[0]).toMatchObject({ name: "projects.md" });
  });
});

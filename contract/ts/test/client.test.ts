import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { HermesClient, nodeHttp, nodeSocket, sessionCookie, splitCombinedSetCookie } from "../src/index.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const fakeScript = path.resolve(here, "../../fake/hermes_fake.py");

function startFake(): Promise<{ port: number; stop: () => void }> {
  return new Promise((resolve, reject) => {
    const proc: ChildProcess = spawn("python3", [fakeScript, "--port", "0"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let buffer = "";
    const timer = setTimeout(() => reject(new Error("fake server did not start")), 5000);
    proc.stdout?.on("data", (chunk) => {
      buffer += String(chunk);
      const match = buffer.match(/LISTENING (\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve({
          port: Number(match[1]),
          stop: () => proc.kill(),
        });
      }
    });
    proc.on("exit", (code) => {
      if (!buffer.includes("LISTENING")) {
        clearTimeout(timer);
        reject(new Error(`fake server exited ${code}`));
      }
    });
  });
}

function client(port: number): HermesClient {
  return new HermesClient({
    serverUrl: `http://127.0.0.1:${port}`,
    http: nodeHttp(),
    socket: nodeSocket(),
  });
}

test("login, ticket, and refresh", async () => {
  const fake = await startFake();
  try {
    const gateway = client(fake.port);
    await assert.rejects(() => gateway.login("tester", "nope"), /Login failed/);
    const material = await gateway.login("tester", "tester");
    assert.equal(material.username, "tester");
    assert.ok(material.accessToken.startsWith("at."));
    assert.ok(material.refreshToken.startsWith("rt."));
    assert.equal(material.provider, "basic");

    await assert.rejects(() => client(fake.port).ticket("not-a-token"), /ticket/);

    const ticket = await gateway.ticket(material.accessToken);
    const socket = nodeSocket();
    await socket.connect(`ws://127.0.0.1:${fake.port}/api/ws?ticket=${encodeURIComponent(ticket)}`);
    socket.close();
    await assert.rejects(
      () => nodeSocket().connect(`ws://127.0.0.1:${fake.port}/api/ws?ticket=${encodeURIComponent(ticket)}`),
      /WebSocket/,
    );

    const rotated = await gateway.refresh(material);
    assert.notEqual(rotated.accessToken, material.accessToken);
    await assert.rejects(() => gateway.refresh(material), /Session expired/);
  } finally {
    fake.stop();
  }
});

test("handshake, approval, and reconnect replay", async () => {
  const fake = await startFake();
  try {
    const gateway = client(fake.port);
    const material = await gateway.login("tester", "tester");
    const approvalPromise = gateway.waitForServerRequest("approval");
    const completePromise = gateway.waitForEvent("message.complete");
    const ready = await gateway.connect(material.accessToken);
    assert.equal(ready.replayEpoch, "epoch-phase0");
    assert.equal(ready.heartbeat, true);
    assert.equal(ready.sessionAuthority, false);

    const approval = await approvalPromise;
    assert.equal(approval.method, "approval");
    assert.equal(approval.params.description, "Read the repo status");
    assert.deepEqual(approval.params.choices, ["once", "deny"]);

    const profiles = await gateway.listProfiles();
    assert.equal(profiles[0]?.displayName, "Junior");
    const sessions = await gateway.listSessions();
    assert.equal(sessions[0]?.id, "sess-1");
    const opened = await gateway.resumeSession("sess-1");
    assert.equal(opened.sessionId, "live-1");
    assert.equal(opened.messages[0]?.text, "Say hello");

    await gateway.submit("live-1", "Say hello");
    const complete = await completePromise;
    assert.equal(complete.payload.text, "Hello from Hermes");
    const seen = complete.seq ?? 0;
    assert.ok(seen >= 3);

    gateway.close();

    const again = client(fake.port);
    const replayedApproval = again.waitForServerRequest("approval");
    const rotated = await again.refresh({
      username: material.username,
      refreshToken: material.refreshToken,
      provider: material.provider,
    });
    await again.connect(rotated.accessToken);
    const replay = await again.replay("live-1", 1);
    assert.equal(replay.truncated, false);
    assert.equal(replay.epoch, "epoch-phase0");
    assert.ok(replay.events.some((event) => event.seq === seen && event.type === "message.complete"));
    const restored = await replayedApproval;
    assert.equal(restored.id, approval.id);
    again.respond(restored.id, { choice: "once" });
    await again.noteApprovalVisible("live-1", String(restored.params.request_id));
    again.close();
  } finally {
    fake.stop();
  }
});

test("session cookies accept host and secure prefixes", () => {
  const headers = [
    {
      name: "set-cookie",
      value:
        "__Host-hermes_session_at=at-1; HttpOnly; Max-Age=3600; Path=/; Expires=Wed, 21 Oct 2026 07:28:00 GMT, __Host-hermes_session_rt=rt-1; HttpOnly; Path=/",
    },
  ];
  const split = splitCombinedSetCookie(headers[0].value).map((value) => ({ name: "set-cookie", value }));
  assert.equal(split.length, 2);
  assert.equal(sessionCookie(split, "hermes_session_at"), "at-1");
  assert.equal(sessionCookie(split, "hermes_session_rt"), "rt-1");
});

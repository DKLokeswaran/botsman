import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  HermesClient,
  HermesError,
  formatPush,
  nodeHttp,
  nodeSocket,
  openRequestIds,
  parsePush,
  routeFocus,
  sessionCookie,
  splitCombinedSetCookie,
  type HttpTransport,
} from "../src/index.ts";

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
    await assert.rejects(() => gateway.login("tester", "nope"), (error: unknown) => {
      assert.ok(error instanceof HermesError);
      assert.equal(error.status, 401);
      assert.equal(error.message, "Login failed (401: Invalid credentials)");
      assert.equal(error.message.includes("nope"), false);
      return true;
    });
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
    await assert.rejects(() => gateway.refresh(material), (error: unknown) => {
      assert.ok(error instanceof HermesError);
      assert.equal(error.status, 401);
      assert.equal(error.message, "Refresh failed (401: Session expired)");
      assert.equal(error.message.includes(material.refreshToken), false);
      return true;
    });
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

test("two clients share one approval", async () => {
  const fake = await startFake();
  const first = client(fake.port);
  const second = client(fake.port);
  try {
    const material = await first.login("tester", "tester");
    const firstCard = first.waitForServerRequest("approval");
    const secondCard = second.waitForServerRequest("approval");
    const cancel = second.waitForEvent("request.cancel");
    await first.connect(material.accessToken);
    await second.connect(material.accessToken);
    const left = await firstCard;
    const right = await secondCard;
    assert.equal(left.id, right.id);
    await first.resumeSession(String(left.params.session_id));
    await second.resumeSession(String(right.params.session_id));
    await first.answerApproval(String(left.params.session_id), String(left.params.request_id), "once");
    const gone = await cancel;
    assert.equal(gone.payload.id, left.id);
    assert.equal(gone.payload.method, "approval");
    assert.equal(gone.payload.reason, "resolved");
    const replay = await second.replay("live-1", 0);
    assert.equal(
      replay.openRequests.some((request) => request.id === left.id),
      false,
    );
  } finally {
    first.close();
    second.close();
    fake.stop();
  }
});

test("test_bug_message_from_socket_a_appears_for_socket_b", async () => {
  const fake = await startFake();
  const first = client(fake.port);
  const second = client(fake.port);
  const third = client(fake.port);
  try {
    const material = await first.login("tester", "tester");
    await first.connect(material.accessToken);
    await second.connect(material.accessToken);
    await third.connect(material.accessToken);
    await first.resumeSession("sess-1");
    await second.resumeSession("sess-1");
    const created = await third.createSession();
    assert.notEqual(created, "live-1");
    await third.resumeSession(created);
    const seen: string[] = [];
    third.onEvent = (event) => {
      seen.push(event.type);
    };
    const changed = third.waitForEvent("sessions.changed");
    const done = second.waitForEvent("message.complete");
    await first.submit("live-1", "from the other phone");
    await changed;
    await done;
    const history = await second.history("live-1");
    assert.equal(
      history.some((row) => row.text === "from the other phone"),
      true,
    );
    assert.equal(seen.includes("message.complete"), false);
    assert.equal(seen.includes("message.delta"), false);
    assert.equal(seen.includes("sessions.changed"), true);
  } finally {
    first.close();
    second.close();
    third.close();
    fake.stop();
  }
});

test("test_bug_deny_cancel_has_no_choice", async () => {
  const fake = await startFake();
  const first = client(fake.port);
  const second = client(fake.port);
  try {
    const material = await first.login("tester", "tester");
    await first.connect(material.accessToken);
    await second.connect(material.accessToken);
    await first.resumeSession("sess-1");
    await second.resumeSession("sess-1");
    const cancel = second.waitForEvent("request.cancel");
    const tool = second.waitForEvent("tool.complete");
    await first.answerApproval("live-1", "req-1", "deny");
    const gone = await cancel;
    assert.equal(gone.payload.reason, "resolved");
    assert.equal(gone.payload.method, "approval");
    assert.equal("choice" in gone.payload, false);
    const finished = await tool;
    assert.match(String(finished.payload.result), /BLOCKED:/);
    assert.match(String(finished.payload.result_text), /denied by user/);
    const cancelled = second.waitForEvent("approval.cancelled");
    await first.interruptSession("live-1");
    const event = await cancelled;
    const ids = event.payload.request_ids;
    assert.ok(Array.isArray(ids));
    assert.deepEqual(ids, []);
  } finally {
    first.close();
    second.close();
    fake.stop();
  }
});

test("test_bug_approval_cancelled_names_request_ids", async () => {
  const fake = await startFake();
  const first = client(fake.port);
  const second = client(fake.port);
  try {
    const material = await first.login("tester", "tester");
    await first.connect(material.accessToken);
    await second.connect(material.accessToken);
    await first.resumeSession("sess-1");
    await second.resumeSession("sess-1");
    const cancelled = second.waitForEvent("approval.cancelled");
    await first.interruptSession("live-1");
    const event = await cancelled;
    const ids = event.payload.request_ids;
    assert.ok(Array.isArray(ids));
    assert.equal((ids as string[]).includes("srq-phase0"), true);
    assert.equal((ids as string[]).includes("req-1"), true);
    assert.equal(event.payload.reason, "interrupted");
  } finally {
    first.close();
    second.close();
    fake.stop();
  }
});

test("push payload routes to a card or a message", () => {
  const approval = parsePush(
    formatPush({
      kind: "approval",
      title: "Approval waiting",
      body: "Read the repo",
      sessionId: "live-1",
      profile: "default",
      requestId: "req-1",
      messageId: "",
      seq: null,
      action: null,
    }),
  );
  assert.equal(approval?.sessionId, "live-1");
  assert.equal(approval?.requestId, "req-1");
  assert.equal(parsePush("not json"), null);
  const open = openRequestIds([{ id: "srq-1", params: { request_id: "req-1", session_id: "live-1" } }]);
  assert.equal(routeFocus(approval!, open, []).resolved, false);
  assert.equal(routeFocus(approval!, new Set(), []).resolved, true);
  assert.equal(routeFocus(approval!, new Set(), []).target, "approval");
  const reply = parsePush(
    '{"kind":"reply","title":"Reply finished","body":"Hi","session_id":"live-1","profile":"default","request_id":"","message_id":"9","seq":4}',
  );
  const landed = routeFocus(reply!, new Set(), [
    { messageId: "1", seq: null },
    { messageId: "9", seq: 4 },
  ]);
  assert.equal(landed.target, "message");
  assert.equal(landed.messageIndex, 1);
  const question = parsePush(
    '{"kind":"clarify","title":"Question waiting","body":"Which?","session_id":"live-1","profile":"","request_id":"q-1","message_id":"","seq":null}',
  );
  const qids = openRequestIds([
    { id: "srq-q", params: { questions: [{ qid: "q-1", question: "Which?" }] } },
  ]);
  assert.equal(qids.has("q-1"), true);
  assert.equal(routeFocus(question!, qids, []).target, "question");
  assert.equal(routeFocus(question!, new Set(), []).resolved, true);
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

test("login surfaces Hermes detail and transport errors without secrets", async () => {
  const password = "not-the-real-password";
  let calls = 0;
  const http: HttpTransport = {
    async request(input) {
      calls += 1;
      if (calls === 1) {
        assert.equal(input.url, "http://100.113.35.96:9119/auth/password-login");
        return {
          status: 400,
          headers: [],
          body: JSON.stringify({
            detail: "Invalid Host header. Dashboard requests must use the bound hostname or the configured public hostname.",
          }),
        };
      }
      if (calls === 2) {
        return {
          status: 302,
          headers: [
            { name: "set-cookie", value: "hermes_session_at=at.kept; HttpOnly" },
            { name: "set-cookie", value: "hermes_session_rt=rt.kept; HttpOnly" },
            { name: "set-cookie", value: "hermes_session_provider=basic; HttpOnly" },
            { name: "location", value: "http://100.113.35.96:9119/" },
          ],
          body: "",
        };
      }
      throw new Error(
        `url not allowed on the configured scope: ${input.url} password=${password} Bearer sekret ticket=sekret`,
      );
    },
  };
  const gateway = new HermesClient({
    serverUrl: "http://100.113.35.96:9119",
    http,
    socket: nodeSocket(),
  });
  await assert.rejects(() => gateway.login("person", password), (error: unknown) => {
    assert.ok(error instanceof HermesError);
    assert.equal(error.status, 400);
    assert.equal(
      error.message,
      "Login failed (400: Invalid Host header. Dashboard requests must use the bound hostname or the configured public hostname.)",
    );
    assert.equal(error.message.includes(password), false);
    return true;
  });
  const kept = await gateway.login("person", password);
  assert.equal(kept.accessToken, "at.kept");
  assert.equal(kept.refreshToken, "rt.kept");
  await assert.rejects(() => gateway.refresh(kept), (error: unknown) => {
    assert.ok(error instanceof HermesError);
    assert.equal(error.status, null);
    assert.match(error.message, /Refresh failed: url not allowed on the configured scope/);
    assert.match(error.message, /http:\/\/100\.113\.35\.96:9119\/auth\/native\/refresh/);
    assert.equal(error.message.includes(password), false);
    assert.equal(error.message.includes("sekret"), false);
    assert.match(error.message, /password=\[redacted\]/);
    assert.match(error.message, /ticket=\[redacted\]/);
    assert.equal(error.message.includes(kept.refreshToken), false);
    return true;
  });
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  LABEL_ANSWERED_ELSEWHERE,
  LABEL_APPROVED_ELSEWHERE,
  LABEL_DENIED,
  LABEL_DENIED_ELSEWHERE,
  LABEL_TIMED_OUT,
  RESOLVED_CARD_MS,
  choiceLabel,
  expireResolved,
  mergeHistory,
  noteLocalChoice,
  onApprovalCancelled,
  onNewerMessage,
  onRequestCancel,
  onToolComplete,
  visibleApproval,
  type ApprovalCard,
} from "../src/session-sync.ts";

function card(sessionId: string, id = "srq-1"): ApprovalCard {
  return {
    id,
    sessionId,
    requestId: "req-1",
    description: "Read the repo",
    command: "git status",
    resolvedLabel: null,
    awaitingTool: false,
  };
}

test("test_bug_deny_shown_as_denied_on_the_other_device", () => {
  const open = noteLocalChoice({}, card("live-1"), "deny");
  assert.equal(open.book["live-1"]?.resolvedLabel, LABEL_DENIED);
  assert.equal(choiceLabel("once"), "Allowed once");
  assert.equal(choiceLabel("session"), "Allowed for session");
  assert.equal(choiceLabel("always"), "Always allowed");

  const remote = onRequestCancel({ "live-1": card("live-1") }, "srq-1", "resolved", new Set());
  assert.equal(remote.book["live-1"]?.resolvedLabel, LABEL_ANSWERED_ELSEWHERE);
  assert.equal(remote.book["live-1"]?.awaitingTool, true);
  assert.equal(remote.effects[0]?.type, "arm");

  const denied = onToolComplete(remote.book, "live-1", "BLOCKED: command denied by user");
  assert.equal(denied.book["live-1"]?.resolvedLabel, LABEL_DENIED_ELSEWHERE);
  assert.equal(denied.book["live-1"]?.awaitingTool, false);

  const allowed = onToolComplete(
    { "live-1": { ...card("live-1"), resolvedLabel: LABEL_ANSWERED_ELSEWHERE, awaitingTool: true } },
    "live-1",
    "ok",
  );
  assert.equal(allowed.book["live-1"]?.resolvedLabel, LABEL_APPROVED_ELSEWHERE);

  const stayed = onToolComplete(
    { "live-1": { ...card("live-1"), resolvedLabel: LABEL_ANSWERED_ELSEWHERE, awaitingTool: true } },
    "live-1",
    "BLOCKED: Command timed out without user response",
  );
  assert.equal(stayed.book["live-1"]?.resolvedLabel, LABEL_ANSWERED_ELSEWHERE);

  const localKept = onRequestCancel(open.book, "srq-1", "resolved", new Set(["srq-1"]));
  assert.equal(localKept.book["live-1"]?.resolvedLabel, LABEL_DENIED);
});

test("test_bug_approval_does_not_leak_into_other_sessions", () => {
  const book = { "live-1": card("live-1"), "live-2": card("live-2", "srq-2") };
  assert.equal(visibleApproval(book, "live-1")?.id, "srq-1");
  assert.equal(visibleApproval(book, "live-2")?.id, "srq-2");
  assert.equal(visibleApproval(book, "live-3"), null);
  assert.equal(visibleApproval(book, null), null);

  const resolved = onRequestCancel(book, "srq-1", "resolved", new Set());
  assert.equal(visibleApproval(resolved.book, "live-2")?.resolvedLabel, null);
  assert.equal(visibleApproval(resolved.book, "live-1")?.resolvedLabel, LABEL_ANSWERED_ELSEWHERE);
});

test("test_bug_resolved_card_clears", () => {
  assert.equal(RESOLVED_CARD_MS, 5000);
  const remote = onRequestCancel({ "live-1": card("live-1") }, "req-1", "resolved", new Set());
  const expired = expireResolved(remote.book, "live-1");
  assert.equal(visibleApproval(expired.book, "live-1"), null);
  assert.equal(expired.effects[0]?.type, "disarm");

  const again = onRequestCancel({ "live-1": card("live-1") }, "srq-1", "resolved", new Set());
  const cleared = onNewerMessage(again.book, "live-1");
  assert.equal(visibleApproval(cleared.book, "live-1"), null);
  const pending = onNewerMessage({ "live-1": card("live-1") }, "live-1");
  assert.equal(pending.book["live-1"]?.resolvedLabel, null);

  const timed = onRequestCancel({ "live-1": card("live-1") }, "srq-1", "timeout", new Set());
  assert.equal(timed.book["live-1"]?.resolvedLabel, LABEL_TIMED_OUT);
  for (const reason of ["interrupted", "shutdown", "session_closed"]) {
    const gone = onRequestCancel({ "live-1": card("live-1") }, "srq-1", reason, new Set());
    assert.equal(visibleApproval(gone.book, "live-1"), null, reason);
  }
  const cancelled = onApprovalCancelled({ "live-1": card("live-1") }, ["req-1"]);
  assert.equal(visibleApproval(cancelled.book, "live-1"), null);
  const untouched = {
    ...card("live-2", "srq-2"),
    requestId: "req-2",
  };
  const other = onApprovalCancelled({ "live-2": untouched }, ["req-1"]);
  assert.equal(other.book["live-2"]?.id, "srq-2");
});

test("test_bug_history_merge_message_from_other_device", () => {
  const local = [
    { role: "user", text: "Say hello", messageId: "1", seq: null },
    { role: "assistant", text: "Hel", messageId: "", seq: 4 },
  ];
  const merged = mergeHistory(local, [
    { role: "user", text: "Say hello", rowId: "1" },
    { role: "user", text: "from the other phone", rowId: "2" },
  ]);
  assert.deepEqual(
    merged.map((line) => line.text),
    ["Say hello", "from the other phone", "Hel"],
  );
  assert.equal(merged[2]?.seq, 4);

  const optimistic = mergeHistory(
    [{ role: "user", text: "from the other phone", messageId: "", seq: null }],
    [{ role: "user", text: "from the other phone", rowId: "8" }],
  );
  assert.equal(optimistic.length, 1);
  assert.equal(optimistic[0]?.messageId, "8");

  const streamed = mergeHistory(
    [{ role: "assistant", text: "Hello from Hermes and more", messageId: "", seq: null }],
    [{ role: "assistant", text: "Hello from Hermes", rowId: "9" }],
  );
  assert.equal(streamed.length, 1);
  assert.equal(streamed[0]?.text, "Hello from Hermes and more");
  assert.equal(streamed[0]?.messageId, "9");
});

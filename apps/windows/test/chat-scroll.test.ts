import assert from "node:assert/strict";
import test from "node:test";

import { NEAR_BOTTOM_PX, classifyScrollEvent, shouldFollow, shouldShowJumpToLatest } from "../src/chat-scroll.ts";

test("test_bug_no_autoscroll_on_send", () => {
  assert.equal(shouldFollow(500, "user_send"), true, "send always follows");
  assert.equal(shouldFollow(NEAR_BOTTOM_PX, "reply_stream"), true);
  assert.equal(shouldFollow(NEAR_BOTTOM_PX + 1, "reply_stream"), false);
  assert.equal(shouldFollow(NEAR_BOTTOM_PX + 1, "user_send"), true);
  assert.equal(shouldShowJumpToLatest(NEAR_BOTTOM_PX), false);
  assert.equal(shouldShowJumpToLatest(NEAR_BOTTOM_PX + 1), true);
  assert.equal(shouldFollow(0, "session_open"), true);
  assert.equal(classifyScrollEvent(2, "older", 3, "user", "sent"), "user_send");
  assert.equal(classifyScrollEvent(3, "Hel", 3, "assistant", "Hello"), "reply_stream");
  assert.equal(classifyScrollEvent(3, "Hello", 3, "assistant", "Hello."), "reply_stream");
  assert.equal(classifyScrollEvent(3, "Hello", 3, "assistant", "Hello"), null);
  assert.equal(classifyScrollEvent(3, "hi", 4, "assistant", "H"), "reply_stream");
  assert.equal(classifyScrollEvent(3, "Hello", 4, "error", "nope"), null);
  const history = classifyScrollEvent(2, "older", 30, "user", "latest");
  assert.equal(history, "reply_stream");
  assert.equal(shouldFollow(500, history!), false);
  assert.equal(shouldFollow(0, history!), true);
});

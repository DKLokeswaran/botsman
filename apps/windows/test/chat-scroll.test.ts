import assert from "node:assert/strict";
import test from "node:test";

import { NEAR_BOTTOM_PX, shouldFollow, shouldShowJumpToLatest } from "../src/chat-scroll.ts";

test("test_bug_no_autoscroll_on_send", () => {
  assert.equal(shouldFollow(500, "user_send"), true, "send always follows");
  assert.equal(shouldFollow(NEAR_BOTTOM_PX, "reply_stream"), true);
  assert.equal(shouldFollow(NEAR_BOTTOM_PX + 1, "reply_stream"), false);
  assert.equal(shouldFollow(NEAR_BOTTOM_PX + 1, "user_send"), true);
  assert.equal(shouldShowJumpToLatest(NEAR_BOTTOM_PX), false);
  assert.equal(shouldShowJumpToLatest(NEAR_BOTTOM_PX + 1), true);
  assert.equal(shouldFollow(0, "session_open"), true);
});

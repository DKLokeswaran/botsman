import assert from "node:assert/strict";
import test from "node:test";

import {
  SESSION_ACTIVATE_REJECTED_CODE,
  SESSION_UNAVAILABLE_CODE,
  isSessionAttachFailure,
  reconnectDelayMs,
} from "../src/attach.ts";
import { HermesError } from "../src/index.ts";

test("isSessionAttachFailure recognises 4007 and session not found", () => {
  assert.equal(isSessionAttachFailure(new HermesError("session not found", null, SESSION_UNAVAILABLE_CODE)), true);
  assert.equal(isSessionAttachFailure(new HermesError("session not active", null, SESSION_ACTIVATE_REJECTED_CODE)), true);
  assert.equal(SESSION_ACTIVATE_REJECTED_CODE, 4001);
  assert.equal(SESSION_UNAVAILABLE_CODE, 4007);
  assert.equal(isSessionAttachFailure(new HermesError("Session not found on server")), true);
  assert.equal(isSessionAttachFailure(new HermesError("network down")), false);
  assert.equal(isSessionAttachFailure(new Error("session not found")), false);
});

test("reconnectDelayMs honours Retry-After and adds jitter", () => {
  const withRetry = reconnectDelayMs(1000, 30);
  assert.ok(withRetry >= 30_000);
  const jittered = reconnectDelayMs(1000, null);
  assert.ok(jittered >= 1000 && jittered <= 1250);
});

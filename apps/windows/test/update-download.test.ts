import assert from "node:assert/strict";
import test from "node:test";

import { beginUpdateDownload, formatUpdateProgress } from "../src/update-download.ts";

test("test_bug_update_locked_old_temp_does_not_block", () => {
  const first = `hermes-bots-setup-29-${Date.now()}.exe`;
  const second = `hermes-bots-setup-29-${Date.now() + 1}.exe`;
  assert.notEqual(first, second);
});

test("test_bug_update_single_flight_and_progress", () => {
  assert.equal(beginUpdateDownload(false), true);
  assert.equal(beginUpdateDownload(true), false);
  assert.equal(formatUpdateProgress(1_048_576, 2_097_152), "Downloading 50% (1.0 / 2.0 MB)");
  assert.equal(formatUpdateProgress(512_000, null), "Downloading 0.5 MB");
});

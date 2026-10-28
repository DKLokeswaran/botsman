import assert from "node:assert/strict";
import test from "node:test";

import { formatAppVersion, parseLatest, updateAvailable } from "../src/update.ts";

const sample = JSON.stringify({
  version: "0.1.0",
  build: 42,
  sha: "1516bc1",
  windows: { url: "http://100.113.35.96:8711/Hermes.Bots_0.1.42_x64-setup.exe", sha256: "abc", size: 10 },
  android: {
    url: "http://100.113.35.96:8711/app-debug.apk",
    sha256: "def",
    size: 20,
    versionCode: 42,
  },
});

test("version label names the build and the short sha", () => {
  assert.equal(formatAppVersion("0.1.0", "42", "1516bc1"), "0.1.0 (build 42, 1516bc1)");
  assert.equal(formatAppVersion("0.1.0", "dev", "dev"), "0.1.0 (build dev, dev)");
});

test("latest.json parses and a higher build is an update", () => {
  const latest = parseLatest(sample);
  assert.equal(latest?.version, "0.1.0");
  assert.equal(latest?.build, 42);
  assert.equal(latest?.android.versionCode, 42);
  assert.equal(latest?.windows.size, 10);
  assert.equal(updateAvailable("41", latest!.build), true);
  assert.equal(updateAvailable("42", latest!.build), false);
  assert.equal(updateAvailable("43", latest!.build), false);
  assert.equal(updateAvailable("dev", latest!.build), true);
  assert.equal(updateAvailable("dev", 0), false);
  assert.equal(parseLatest("not json"), null);
  assert.equal(parseLatest('{"version":"0.1.0","build":1,"sha":"abc"}'), null);
});

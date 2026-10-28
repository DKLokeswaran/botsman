import assert from "node:assert/strict";
import test from "node:test";

import {
  credentialsForLogin,
  loginFailureStatus,
  passwordEdgeHint,
  passwordInputProps,
  usernameInputProps,
} from "../src/login-form.ts";

test("test_bug_login_stray_whitespace", () => {
  const credentials = credentialsForLogin("  person \n", " secret ");
  assert.equal(credentials.username, "person");
  assert.equal(credentials.password, " secret ");
  assert.equal(credentialsForLogin("Lo Kes", "pw").username, "Lo Kes");

  assert.equal(usernameInputProps.autoCapitalize, "none");
  assert.equal(usernameInputProps.autoCorrect, "off");
  assert.equal(usernameInputProps.spellCheck, false);
  assert.equal(usernameInputProps.inputMode, "email");
  assert.equal(passwordInputProps.type, "password");
  assert.equal(passwordInputProps.autoCapitalize, "none");
  assert.equal(passwordInputProps.autoCorrect, "off");
  assert.equal(passwordInputProps.spellCheck, false);

  const invalid = "Login failed (401: Invalid credentials)";
  assert.equal(loginFailureStatus(401, invalid, "secret"), "Wrong username or password");
  assert.equal(
    loginFailureStatus(401, invalid, "secret "),
    "Wrong username or password. Your password ends with a space",
  );
  assert.equal(
    loginFailureStatus(401, "Login failed (401: invalid_credentials)", " secret"),
    "Wrong username or password. Your password starts with a space",
  );
  assert.equal(
    loginFailureStatus(401, "Login failed (401)", " secret\n"),
    "Wrong username or password. Your password starts and ends with a space",
  );
  assert.equal(
    loginFailureStatus(401, "Login failed (401: Unauthorized)", "sec ret"),
    "Wrong username or password",
  );
  assert.equal(passwordEdgeHint("sec ret"), null);
  assert.equal(loginFailureStatus(429, "Login failed (429: rate_limited)", "secret "), "Too many attempts");
  assert.equal(loginFailureStatus(401, "Login failed (401: Too many attempts)", "secret "), "Too many attempts");
  assert.equal(loginFailureStatus(429, "Login failed (429: rate_limited)", "secret ").includes("space"), false);

  const host =
    "Login failed (400: Invalid Host header. Dashboard requests must use the bound hostname or the configured public hostname.)";
  assert.equal(loginFailureStatus(400, host, "secret "), host);
});

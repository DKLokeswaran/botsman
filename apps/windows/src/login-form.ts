/** Trim the username only. A password may legitimately start or end with a space. */
export function credentialsForLogin(username: string, password: string): { username: string; password: string } {
  return { username: username.trim(), password };
}

/** No auto-capitalisation and no suggestions. Email-style, same idea as a login name. */
export const usernameInputProps = {
  autoCapitalize: "none",
  autoCorrect: "off",
  spellCheck: false,
  autoComplete: "username",
  inputMode: "email",
} as const;

/** Password field, suggestions off. The value is not trimmed. */
export const passwordInputProps = {
  type: "password",
  autoCapitalize: "none",
  autoCorrect: "off",
  spellCheck: false,
  autoComplete: "current-password",
} as const;

/**
 * Login failures name the server reason. A bare 401 is invalid credentials.
 * Rate limiting is separate, and a stray space on the password is called out.
 */
export function loginFailureStatus(status: number | null, message: string, password: string): string {
  if (isRateLimited(status, message)) {
    return "Too many attempts";
  }
  if (!isInvalidCredentials(status, message)) {
    return message || "Login failed";
  }
  const hint = passwordEdgeHint(password);
  return hint ? `Wrong username or password. ${hint}` : "Wrong username or password";
}

export function passwordEdgeHint(password: string): string | null {
  if (!password) {
    return null;
  }
  const leading = /\s/.test(password[0] ?? "");
  const trailing = /\s/.test(password[password.length - 1] ?? "");
  if (leading && trailing) {
    return "Your password starts and ends with a space";
  }
  if (trailing) {
    return "Your password ends with a space";
  }
  if (leading) {
    return "Your password starts with a space";
  }
  return null;
}

function isRateLimited(status: number | null, message: string): boolean {
  const text = message.toLowerCase();
  return status === 429 || text.includes("rate_limited") || text.includes("too many");
}

function isInvalidCredentials(status: number | null, message: string): boolean {
  if (isRateLimited(status, message)) {
    return false;
  }
  const text = message.toLowerCase();
  if (text.includes("invalid_credentials") || text.includes("invalid credentials") || text.includes("unauthorized")) {
    return true;
  }
  return status === 401;
}

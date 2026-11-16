import type { SessionInfo, Tokens } from "@botsman/protocol";

// The web dashboard keeps its tokens in cookies that page scripts can't read. The apps send a bearer token instead.
export const ACCESS_COOKIE = "botsman_access";
export const REFRESH_COOKIE = "botsman_refresh";

const ACCESS_PATH = "/api";
const REFRESH_PATH = "/api/auth";

// One cookie's value from a Cookie header.
export function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name && rest.length > 0) return rest.join("=");
  }
  return undefined;
}

// The Set-Cookie lines that sign a browser in. The refresh cookie only travels to the auth routes.
export function sessionCookies(tokens: Tokens, now: number): string[] {
  return [
    cookie(ACCESS_COOKIE, tokens.accessToken, ACCESS_PATH, tokens.accessExpiresAt - now),
    cookie(REFRESH_COOKIE, tokens.refreshToken, REFRESH_PATH, tokens.refreshExpiresAt - now),
  ];
}

export function clearedCookies(): string[] {
  return [cookie(ACCESS_COOKIE, "", ACCESS_PATH, 0), cookie(REFRESH_COOKIE, "", REFRESH_PATH, 0)];
}

// What a browser learns about its session, with the tokens themselves left in the cookies.
export function sessionInfo(tokens: Tokens): SessionInfo {
  return { sessionId: tokens.sessionId, accessExpiresAt: tokens.accessExpiresAt, refreshExpiresAt: tokens.refreshExpiresAt };
}

// Whether a request's Origin header names this server. Cookies ride along on requests another site starts,
// so anything that acts on a cookie must come from the dashboard's own pages.
export function sameOrigin(origin: string | undefined, host: string): boolean {
  if (origin === undefined) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function cookie(name: string, value: string, path: string, lifetimeMs: number): string {
  const maxAge = Math.max(0, Math.floor(lifetimeMs / 1000));
  return `${name}=${value}; Path=${path}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

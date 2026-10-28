/**
 * Browser stand-in for @tauri-apps/plugin-http.
 * The Fetch API hides Set-Cookie. When the fake is started with
 * HERMES_FAKE_TEST_HOOKS=1 it repeats those cookies in X-E2E-Set-Cookie
 * so this shim can surface them the way the native plugin does.
 */

type HeaderBag = {
  get(name: string): string | null;
  getSetCookie(): string[];
  forEach(callback: (value: string, name: string) => void): void;
};

class ShimHeaders implements HeaderBag {
  private readonly rows: Array<{ name: string; value: string }> = [];

  constructor(entries: Array<{ name: string; value: string }>) {
    this.rows = entries;
  }

  get(name: string): string | null {
    const found = this.rows.filter((row) => row.name.toLowerCase() === name.toLowerCase());
    if (found.length === 0) {
      return null;
    }
    return found.map((row) => row.value).join(", ");
  }

  getSetCookie(): string[] {
    return this.rows.filter((row) => row.name.toLowerCase() === "set-cookie").map((row) => row.value);
  }

  forEach(callback: (value: string, name: string) => void): void {
    for (const row of this.rows) {
      callback(row.value, row.name);
    }
  }
}

export type FetchInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  connectTimeout?: number;
  maxRedirections?: number;
};

function localHost(url: string): boolean {
  const host = new URL(url).hostname;
  return host === "127.0.0.1" || host === "localhost";
}

function cookiesFrom(header: string | null): string[] {
  if (!header) {
    return [];
  }
  const parsed: unknown = JSON.parse(atob(header));
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter((item): item is string => typeof item === "string");
}

export async function fetch(url: string, init: FetchInit = {}): Promise<{
  ok: boolean;
  status: number;
  headers: HeaderBag;
  text: () => Promise<string>;
}> {
  if (!localHost(url)) {
    throw new Error(`Update check failed from ${url}. connect ECONNREFUSED`);
  }
  const response = await globalThis.fetch(url, {
    method: init.method ?? "GET",
    headers: init.headers,
    body: init.body,
    redirect: init.maxRedirections === 0 ? "manual" : "follow",
    signal: AbortSignal.timeout(init.connectTimeout ?? 20_000),
  });
  const entries: Array<{ name: string; value: string }> = [];
  response.headers.forEach((value, name) => {
    if (name.toLowerCase() === "set-cookie" || name.toLowerCase() === "x-e2e-set-cookie") {
      return;
    }
    entries.push({ name, value });
  });
  for (const cookie of cookiesFrom(response.headers.get("x-e2e-set-cookie"))) {
    entries.push({ name: "set-cookie", value: cookie });
  }
  const body = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    headers: new ShimHeaders(entries),
    text: async () => body,
  };
}

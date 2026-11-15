import type { ErrorBody, Health } from "@botsman/protocol";

// The part of `fetch` the client uses. Each app passes its own: the browser's, Tauri's HTTP plugin, or React Native's.
export type Fetch = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<FetchResponse>;
export type FetchResponse = { ok: boolean; status: number; text(): Promise<string> };

// A reply the server sent with an error status.
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string | undefined;

  constructor(status: number, body: Partial<ErrorBody> | undefined) {
    super(body?.message ?? `The server answered ${status}`);
    this.status = status;
    this.code = body?.error ?? "internal";
    this.detail = body?.detail;
  }
}

// The server could not be reached at all.
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super("Can't reach the server", { cause });
  }
}

export type ApiClientOptions = {
  baseUrl: string;
  fetch: Fetch;
  accessToken?: () => string | undefined;
};

// Talks to one Botsman server over HTTPS, using only the `protocol` package's types.
export class ApiClient {
  readonly baseUrl: string;
  readonly #fetch: Fetch;
  readonly #accessToken: () => string | undefined;

  constructor(options: ApiClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.#fetch = options.fetch;
    this.#accessToken = options.accessToken ?? (() => undefined);
  }

  health(): Promise<Health> {
    return this.request("GET", "/api/health");
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await this.#send(method, path, body);
    const data = parseJson(await response.text());
    if (!response.ok) throw new ApiError(response.status, data as Partial<ErrorBody> | undefined);
    return data as T;
  }

  async #send(method: string, path: string, body: unknown): Promise<FetchResponse> {
    const token = this.#accessToken();
    const headers: Record<string, string> = {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
    };
    try {
      return await this.#fetch(`${this.baseUrl}${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    } catch (error) {
      throw new NetworkError(error);
    }
  }
}

// Accepts what an owner types: surrounding spaces, a missing scheme, or a trailing slash.
export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (trimmed === "" || /^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function parseJson(text: string): unknown {
  if (text === "") return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

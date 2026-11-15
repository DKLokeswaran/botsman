import { expect, test } from "vitest";
import { ApiClient, ApiError, type Fetch, NetworkError, normalizeBaseUrl } from "../src/index.ts";

function reply(status: number, body: unknown): Fetch {
  return async () => ({ ok: status < 400, status, text: async () => (body === undefined ? "" : JSON.stringify(body)) });
}

test("normalizes what an owner types as the address", () => {
  expect(normalizeBaseUrl(" devbox.example.ts.net/ ")).toBe("https://devbox.example.ts.net");
  expect(normalizeBaseUrl("https://bots.example.com//")).toBe("https://bots.example.com");
  expect(normalizeBaseUrl("")).toBe("");
});

test("returns the parsed body of a successful reply", async () => {
  const health = { ok: true, version: "0.1.0", sandbox: { ok: true, reason: null } };
  const client = new ApiClient({ baseUrl: "https://bots.example.com", fetch: reply(200, health) });
  expect(await client.health()).toEqual(health);
});

test("sends the access token and a JSON body", async () => {
  const seen: { url: string; headers?: Record<string, string>; body?: string }[] = [];
  const fetch: Fetch = async (url, init) => {
    seen.push({ url, headers: init?.headers, body: init?.body });
    return { ok: true, status: 200, text: async () => "{}" };
  };
  const client = new ApiClient({ baseUrl: "bots.example.com", fetch, accessToken: () => "token-1" });
  await client.request("POST", "/api/bots", { name: "Junior" });
  expect(seen).toEqual([
    {
      url: "https://bots.example.com/api/bots",
      headers: { "content-type": "application/json", authorization: "Bearer token-1" },
      body: '{"name":"Junior"}',
    },
  ]);
});

test("turns an error reply into an ApiError with the server's code", async () => {
  const client = new ApiClient({ baseUrl: "https://bots.example.com", fetch: reply(403, { error: "https_required", message: "This server only accepts HTTPS" }) });
  const error = await client.health().catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ status: 403, code: "https_required", message: "This server only accepts HTTPS" });
});

test("turns a failed connection into a NetworkError", async () => {
  const fetch: Fetch = async () => {
    throw new TypeError("fetch failed");
  };
  const client = new ApiClient({ baseUrl: "https://bots.example.com", fetch });
  await expect(client.health()).rejects.toBeInstanceOf(NetworkError);
});

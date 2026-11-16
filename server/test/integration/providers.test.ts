import type { ModelList, ProviderList } from "@botsman/protocol";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setUpServer, startTestServer, type TestServer } from "../helpers.ts";

describe("model providers", () => {
  let server: TestServer;

  beforeAll(async () => {
    process.env.OPENAI_API_KEY = "sk-from-the-environment";
    server = await startTestServer();
    await setUpServer(server);
  });

  afterAll(async () => {
    delete process.env.OPENAI_API_KEY;
    await server?.botsman.stop();
    server?.root.cleanup();
  });

  it("lists the first providers with their connection methods", async () => {
    const { providers } = await server.client.request<ProviderList>("GET", "/api/providers");
    const methods = Object.fromEntries(providers.map((provider) => [provider.id, provider.methods]));
    expect(methods).toMatchObject({
      "opencode-go": ["api_key"],
      anthropic: ["api_key"],
      openai: ["api_key", "oauth"],
      openrouter: ["api_key", "oauth"],
      "github-copilot": ["oauth"],
    });
  });

  it("ignores keys in the server's environment", async () => {
    const { providers } = await server.client.request<ProviderList>("GET", "/api/providers");
    expect(providers.find((provider) => provider.id === "openai")).toMatchObject({ connected: false });
    expect(await server.botsman.services.catalog.models.getAuth("openai")).toBeUndefined();
  });

  it("stores a key encrypted and never returns it", async () => {
    await server.client.saveKey("openrouter", "sk-or-secret-value");
    const listing = await server.client.raw("GET", "/api/providers");
    expect(await listing.text()).not.toContain("sk-or-secret-value");
    const row = server.botsman.services.db.prepare("SELECT sealed FROM credentials WHERE provider_id = 'openrouter'").get() as { sealed: string };
    expect(row.sealed).not.toContain("sk-or-secret-value");
    const { models } = await server.client.request<ModelList>("GET", "/api/models");
    expect(models.some((model) => model.provider === "openrouter")).toBe(true);
    await server.client.request("DELETE", "/api/providers/openrouter");
  });

  it("refuses a sign-in for a provider without one", async () => {
    const response = await server.client.raw("POST", "/api/providers/opencode-go/login");
    expect(response.status).toBe(400);
  });

  // GitHub Copilot asks for an Enterprise domain before it contacts anything, so this stays offline.
  it("says a cancelled sign-in is cancelled in the answer to the cancel", async () => {
    type Login = { id: string; status: string; pendingPrompt: string | null };
    const started = await server.client.request<Login>("POST", "/api/providers/github-copilot/login");
    const deadline = Date.now() + 5_000;
    while ((await server.client.request<Login>("GET", `/api/provider-logins/${started.id}`)).pendingPrompt === null && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
    const cancelled = await server.client.request<Login>("POST", `/api/provider-logins/${started.id}/cancel`);
    expect(cancelled).toMatchObject({ status: "cancelled", pendingPrompt: null });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect((await server.client.request<Login>("GET", `/api/provider-logins/${started.id}`)).status).toBe("cancelled");
  });
});

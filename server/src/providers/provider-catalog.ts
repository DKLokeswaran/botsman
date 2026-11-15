import type { ModelInfo, Provider as ProviderView } from "@botsman/protocol";
import { createModels, type CredentialStore, type MutableModels, type Provider } from "@earendil-works/pi-ai";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";
import { githubCopilotProvider } from "@earendil-works/pi-ai/providers/github-copilot";
import { openaiProvider } from "@earendil-works/pi-ai/providers/openai";
import { opencodeGoProvider } from "@earendil-works/pi-ai/providers/opencode-go";
import { openrouterProvider } from "@earendil-works/pi-ai/providers/openrouter";
import { notFound } from "../errors.ts";

type Method = "api_key" | "oauth";

type ProviderEntry = { readonly provider: Provider; readonly methods: readonly Method[] };

// The first providers, with the connection methods docs/decisions/permissions.md lists. Anthropic's sign-in is
// left out: the Claude subscription replaces it.
function firstProviders(): ProviderEntry[] {
  return [
    { provider: opencodeGoProvider(), methods: ["api_key"] },
    { provider: anthropicProvider(), methods: ["api_key"] },
    { provider: openaiProvider(), methods: ["api_key", "oauth"] },
    { provider: openrouterProvider(), methods: ["api_key", "oauth"] },
    { provider: githubCopilotProvider(), methods: ["oauth"] },
  ];
}

// Credentials resolve only from the server's own store, never from the server's environment variables.
const NO_AMBIENT_AUTH = { env: async () => undefined, fileExists: async () => false };

// The model providers the server offers, and the pi-ai `Models` collection bots use.
export class ProviderCatalog {
  readonly models: MutableModels;
  readonly #entries: ProviderEntry[];
  readonly #credentials: CredentialStore;

  constructor(credentials: CredentialStore, extra: readonly ProviderEntry[] = []) {
    this.#credentials = credentials;
    this.#entries = [...firstProviders(), ...extra];
    this.models = createModels({ credentials, authContext: NO_AMBIENT_AUTH, identity: { attribution: null } });
    for (const entry of this.#entries) this.models.setProvider(entry.provider);
  }

  entry(providerId: string): ProviderEntry {
    const entry = this.#entries.find((candidate) => candidate.provider.id === providerId);
    if (entry === undefined) throw notFound(`Provider ${providerId}`);
    return entry;
  }

  async list(): Promise<ProviderView[]> {
    const stored = new Map((await this.#credentials.list()).map((info) => [info.providerId, info.type]));
    return this.#entries.map(({ provider, methods }) => ({
      id: provider.id,
      name: provider.name,
      methods: [...methods],
      oauthLabel: methods.includes("oauth") ? (provider.auth.oauth?.loginLabel ?? provider.auth.oauth?.name ?? "Sign in") : null,
      connected: stored.has(provider.id),
      connectedWith: stored.get(provider.id) ?? null,
    }));
  }

  async isConnected(providerId: string): Promise<boolean> {
    return (await this.#credentials.list()).some((info) => info.providerId === providerId);
  }

  // Chat models of every connected provider.
  async connectedModels(): Promise<ModelInfo[]> {
    const connected = new Set((await this.#credentials.list()).map((info) => info.providerId));
    return this.#entries
      .filter(({ provider }) => connected.has(provider.id))
      .flatMap(({ provider }) => this.models.getModels(provider.id))
      .map((model) => ({ provider: model.provider, id: model.id, name: model.name, contextWindow: model.contextWindow, reasoning: model.reasoning }));
  }

  hasModel(providerId: string, modelId: string): boolean {
    return this.models.getModel(providerId, modelId) !== undefined;
  }

  async saveApiKey(providerId: string, key: string): Promise<void> {
    this.entry(providerId);
    await this.#credentials.modify(providerId, async () => ({ type: "api_key", key }));
  }

  async disconnect(providerId: string): Promise<void> {
    this.entry(providerId);
    await this.#credentials.delete(providerId);
  }
}

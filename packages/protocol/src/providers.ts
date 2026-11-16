import { ThinkingLevel } from "./bots.ts";
import { arr, bool, int, lit, nullable, obj, oneOf, opt, type Static, str, union } from "@earendil-works/pi-schema";

export const ProviderMethods = ["api_key", "oauth"] as const;

// A model provider and how the owner can connect it. Secrets are never sent back.
export const Provider = obj({
  id: str(),
  name: str(),
  methods: arr(oneOf(ProviderMethods)),
  oauthLabel: nullable(str()),
  connected: bool(),
  connectedWith: nullable(oneOf(ProviderMethods)),
});
export type Provider = Static<typeof Provider>;

export const ProviderList = obj({ providers: arr(Provider) });
export type ProviderList = Static<typeof ProviderList>;

export const ApiKeyRequest = obj({ key: str({ minLength: 1, maxLength: 4096 }) });
export type ApiKeyRequest = Static<typeof ApiKeyRequest>;

export const ModelInfo = obj({
  provider: str(),
  id: str(),
  name: str(),
  contextWindow: int(),
  reasoning: bool(),
  // The reasoning levels this model supports, lowest first. Missing from servers older than this field.
  thinkingLevels: opt(arr(ThinkingLevel)),
});
export type ModelInfo = Static<typeof ModelInfo>;

export const ModelList = obj({ models: arr(ModelInfo) });
export type ModelList = Static<typeof ModelList>;

// One step of a sign-in the server runs, shown by the app.
export const LoginStep = union([
  obj({ type: lit("auth_url"), url: str(), instructions: nullable(str()) }),
  obj({ type: lit("device_code"), userCode: str(), verificationUri: str() }),
  obj({
    type: lit("prompt"),
    promptId: str(),
    kind: oneOf(["text", "secret", "select", "manual_code"]),
    message: str(),
    placeholder: nullable(str()),
    options: arr(obj({ id: str(), label: str() })),
  }),
  obj({ type: lit("info"), message: str() }),
  obj({ type: lit("progress"), message: str() }),
]);
export type LoginStep = Static<typeof LoginStep>;

export const LoginStatuses = ["running", "succeeded", "failed", "cancelled"] as const;

export const ProviderLogin = obj({
  id: str(),
  providerId: str(),
  status: oneOf(LoginStatuses),
  steps: arr(LoginStep),
  pendingPrompt: nullable(str()),
  error: nullable(str()),
});
export type ProviderLogin = Static<typeof ProviderLogin>;

export const LoginAnswer = obj({ promptId: str(), value: str({ maxLength: 8192 }) });
export type LoginAnswer = Static<typeof LoginAnswer>;

export const LoginParams = obj({ loginId: str({ minLength: 1 }) });
export type LoginParams = Static<typeof LoginParams>;

export const LoginStart = obj({ method: opt(oneOf(["oauth"])) });
export type LoginStart = Static<typeof LoginStart>;

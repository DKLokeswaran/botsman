import type { LoginStep, Provider, ProviderLogin } from "@botsman/protocol";
import { useState } from "react";
import { connectLabel, connectMethods, loginLine, loginView, providerStatus } from "../providers.ts";
import { useBotsmanClient } from "./client-context.tsx";
import { useAction } from "./use-action.ts";
import { useLogin, useProviders } from "./use-providers.ts";

// The provider list, with at most one provider's Connect form open.
export function useProviderList() {
  const { providers, error } = useProviders();
  const [openId, setOpenId] = useState<string>();
  return { providers, error, openId, toggle: (id: string) => setOpenId(openId === id ? undefined : id) };
}

// One provider's row: its status, the label of the button that opens its form, and removing it.
export function useProviderRow(provider: Provider, open: boolean) {
  const client = useBotsmanClient();
  const remove = useAction(() => client.disconnectProvider(provider.id));
  return { status: providerStatus(provider.connected, provider.connectedWith), connectLabel: connectLabel(provider, open), remove };
}

// A provider's Connect form: the chosen way to connect, and the others, if there are any.
export function useConnectForm(provider: Provider) {
  const [method, setMethod] = useState(provider.methods[0]!);
  return { method, setMethod, methods: connectMethods(provider) };
}

// Connecting with an API key. `onDone` runs once the key is saved.
export function useApiKeyForm(provider: Provider, onDone: () => void) {
  const client = useBotsmanClient();
  const [key, setKey] = useState("");
  const save = useAction(async () => {
    await client.saveApiKey(provider.id, key);
    onDone();
  });
  const ready = key.trim() !== "" && !save.busy;
  return { label: `${provider.name} API key`, key, setKey, ready, error: save.error, submit: () => void (ready && save.run()) };
}

// Connecting with a browser sign-in the server runs. The sign-in is undefined until it starts, and `restart` drops one
// that ended.
export function useProviderSignIn(provider: Provider) {
  const client = useBotsmanClient();
  const [loginId, setLoginId] = useState<string>();
  const login = useLogin(loginId);
  const start = useAction(async () => setLoginId((await client.startLogin(provider.id)).id));
  return { login, start, restart: () => setLoginId(undefined) };
}

// A started sign-in's steps, the line that says how it is going or how it ended, and cancelling it while it runs.
export function useLoginSteps(login: ProviderLogin) {
  const client = useBotsmanClient();
  const view = loginView(login);
  const { link, code, prompt } = view;
  const cancel = view.outcome === "running" ? () => void client.cancelLogin(login.id) : undefined;
  return { link, linkText: link?.instructions ?? "Open this address and sign in.", code, prompt, line: loginLine(view), cancel };
}

// Answering the question a sign-in waits on. A choice starts on its first option.
export function useLoginPrompt(loginId: string, prompt: Extract<LoginStep, { type: "prompt" }>) {
  const client = useBotsmanClient();
  const [value, setValue] = useState(prompt.options[0]?.id ?? "");
  const answer = useAction(() => client.answerLogin(loginId, prompt.promptId, value));
  return { value, setValue, answer };
}

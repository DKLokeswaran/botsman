import { loginView, providerStatus } from "@botsman/client-core";
import { useAction, useBotsmanClient, useLogin, useProviders } from "@botsman/client-core/react";
import type { Provider } from "@botsman/protocol";
import { useState } from "react";
import { ErrorText, Page, Segmented } from "../components/page.tsx";
import { Button } from "../components/ui/button.tsx";
import { Field } from "../components/ui/field.tsx";

// Every model provider with its status, and the ways to connect, replace, or remove one. Saved keys are never shown.
export function ProvidersScreen() {
  return (
    <Page title="Model providers" back="#/">
      <p className="text-sm text-muted-foreground">Keys and sign-ins are stored on the server, sealed, and can't be viewed again.</p>
      <ProviderList />
    </Page>
  );
}

// Every provider, each opening to its Connect form. Also used in first-run setup.
export function ProviderList() {
  const { providers, error } = useProviders();
  const [open, setOpen] = useState<string>();
  return (
    <>
      <ErrorText>{error}</ErrorText>
      {providers === undefined ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {providers?.map((provider) => (
        <ProviderRow key={provider.id} provider={provider} open={open === provider.id} onOpen={() => setOpen(open === provider.id ? undefined : provider.id)} />
      ))}
    </>
  );
}

function ProviderRow({ provider, open, onOpen }: { provider: Provider; open: boolean; onOpen: () => void }) {
  const client = useBotsmanClient();
  const remove = useAction(() => client.disconnectProvider(provider.id));
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-semibold">{provider.name}</span>
          <span className={`block text-xs ${provider.connected ? "text-primary" : "text-muted-foreground"}`}>{providerStatus(provider.connected, provider.connectedWith)}</span>
        </span>
        <span className="flex gap-2">
          <Button variant={provider.connected ? "ghost" : "primary"} onClick={onOpen}>
            {open ? "Close" : provider.connected ? "Replace" : "Connect"}
          </Button>
          {provider.connected ? (
            <Button variant="danger" disabled={remove.busy} onClick={() => void remove.run()}>
              Remove
            </Button>
          ) : null}
        </span>
      </div>
      <ErrorText>{remove.error}</ErrorText>
      {open ? <ConnectForm provider={provider} onDone={onOpen} /> : null}
    </div>
  );
}

function ConnectForm({ provider, onDone }: { provider: Provider; onDone: () => void }) {
  const [method, setMethod] = useState(provider.methods[0]!);
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      {provider.methods.length < 2 ? null : (
        <Segmented label="How to connect" options={provider.methods.map((option) => ({ value: option, label: option === "api_key" ? "API key" : (provider.oauthLabel ?? "Sign in") }))} value={method} onChange={setMethod} />
      )}
      {method === "api_key" ? <ApiKeyForm provider={provider} onDone={onDone} /> : <SignIn provider={provider} />}
    </div>
  );
}

function ApiKeyForm({ provider, onDone }: { provider: Provider; onDone: () => void }) {
  const client = useBotsmanClient();
  const [key, setKey] = useState("");
  const save = useAction(async () => {
    await client.saveApiKey(provider.id, key);
    onDone();
  });
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void save.run();
      }}
    >
      <Field label={`${provider.name} API key`} type="password" autoComplete="off" value={key} onChange={(event) => setKey(event.target.value)} />
      <ErrorText>{save.error}</ErrorText>
      <Button type="submit" variant="primary" className="self-start" disabled={key.trim() === "" || save.busy}>
        Save key
      </Button>
    </form>
  );
}

// A browser sign-in the server runs: open the address, enter any code there, and answer what the provider asks.
function SignIn({ provider }: { provider: Provider }) {
  const client = useBotsmanClient();
  const [loginId, setLoginId] = useState<string>();
  const login = useLogin(loginId);
  const start = useAction(async () => setLoginId((await client.startLogin(provider.id)).id));
  if (login === undefined)
    return (
      <div className="flex flex-col gap-2">
        <ErrorText>{start.error}</ErrorText>
        <Button variant="primary" className="self-start" disabled={start.busy} onClick={() => void start.run()}>
          Start sign-in
        </Button>
      </div>
    );
  const view = loginView(login);
  return (
    <div className="flex flex-col gap-3 text-sm">
      {view.link === undefined ? null : (
        <div className="flex flex-col gap-1.5">
          <p>{view.link.instructions ?? "Open this address and sign in."}</p>
          <a href={view.link.url} target="_blank" rel="noreferrer" className="break-all text-primary underline">
            {view.link.url}
          </a>
        </div>
      )}
      {view.code === undefined ? null : (
        <p>
          Enter <span className="font-mono text-base font-bold">{view.code.userCode}</span> at{" "}
          <a href={view.code.verificationUri} target="_blank" rel="noreferrer" className="text-primary underline">
            {view.code.verificationUri}
          </a>
        </p>
      )}
      {view.prompt === undefined ? null : <LoginPrompt key={view.prompt.promptId} loginId={login.id} prompt={view.prompt} />}
      {view.outcome === "running" && view.progress !== undefined ? <p className="text-muted-foreground">{view.progress}</p> : null}
      {view.outcome === "connected" ? <p className="text-primary">Connected.</p> : null}
      {view.outcome === "failed" || view.outcome === "cancelled" ? <ErrorText>{view.error ?? "The sign-in stopped."}</ErrorText> : null}
      {view.outcome === "running" ? (
        <Button variant="text" className="self-start" onClick={() => void client.cancelLogin(login.id)}>
          Cancel sign-in
        </Button>
      ) : (
        <Button variant="text" className="self-start" onClick={() => setLoginId(undefined)}>
          Start again
        </Button>
      )}
    </div>
  );
}

function LoginPrompt({ loginId, prompt }: { loginId: string; prompt: NonNullable<ReturnType<typeof loginView>["prompt"]> }) {
  const client = useBotsmanClient();
  const [value, setValue] = useState(prompt.options[0]?.id ?? "");
  const answer = useAction(() => client.answerLogin(loginId, prompt.promptId, value));
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void answer.run();
      }}
    >
      {prompt.kind === "select" ? (
        <label className="flex flex-col gap-1.5">
          <span className="font-medium">{prompt.message}</span>
          <select className="rounded-lg border border-input bg-background px-3 py-2" value={value} onChange={(event) => setValue(event.target.value)}>
            {prompt.options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <Field label={prompt.message} type={prompt.kind === "secret" ? "password" : "text"} placeholder={prompt.placeholder ?? undefined} autoComplete="off" value={value} onChange={(event) => setValue(event.target.value)} />
      )}
      <ErrorText>{answer.error}</ErrorText>
      <Button type="submit" variant="primary" className="self-start" disabled={answer.busy}>
        Continue
      </Button>
    </form>
  );
}

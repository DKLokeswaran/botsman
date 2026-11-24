import type { Provider } from "@botsman/client-core";
import { useApiKeyForm, useConnectForm, useLoginPrompt, useLoginSteps, useProviderList, useProviderRow, useProviderSignIn } from "@botsman/client-core/react";
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
  const { providers, error, openId, toggle } = useProviderList();
  return (
    <>
      <ErrorText>{error}</ErrorText>
      {providers === undefined ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {providers?.map((provider) => (
        <ProviderRow key={provider.id} provider={provider} open={openId === provider.id} onOpen={() => toggle(provider.id)} />
      ))}
    </>
  );
}

function ProviderRow({ provider, open, onOpen }: { provider: Provider; open: boolean; onOpen: () => void }) {
  const { status, connectLabel, remove } = useProviderRow(provider, open);
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-semibold">{provider.name}</span>
          <span className={`block text-xs ${provider.connected ? "text-primary" : "text-muted-foreground"}`}>{status}</span>
        </span>
        <span className="flex gap-2">
          <Button variant={provider.connected ? "ghost" : "primary"} onClick={onOpen}>
            {connectLabel}
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
  const { method, setMethod, methods } = useConnectForm(provider);
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      {methods === undefined ? null : <Segmented label="How to connect" options={methods} value={method} onChange={setMethod} />}
      {method === "api_key" ? <ApiKeyForm provider={provider} onDone={onDone} /> : <SignIn provider={provider} />}
    </div>
  );
}

function ApiKeyForm({ provider, onDone }: { provider: Provider; onDone: () => void }) {
  const form = useApiKeyForm(provider, onDone);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        form.submit();
      }}
    >
      <Field label={form.label} type="password" autoComplete="off" value={form.key} onChange={(event) => form.setKey(event.target.value)} />
      <ErrorText>{form.error}</ErrorText>
      <Button type="submit" variant="primary" className="self-start" disabled={!form.ready}>
        Save key
      </Button>
    </form>
  );
}

// A browser sign-in the server runs: open the address, enter any code there, and answer what the provider asks.
function SignIn({ provider }: { provider: Provider }) {
  const { login, start, restart } = useProviderSignIn(provider);
  if (login === undefined)
    return (
      <div className="flex flex-col gap-2">
        <ErrorText>{start.error}</ErrorText>
        <Button variant="primary" className="self-start" disabled={start.busy} onClick={() => void start.run()}>
          Start sign-in
        </Button>
      </div>
    );
  return <LoginSteps login={login} onRestart={restart} />;
}

type Login = NonNullable<ReturnType<typeof useProviderSignIn>["login"]>;
type SignInSteps = ReturnType<typeof useLoginSteps>;

// The running sign-in: the address to open, any code to enter, the provider's question, and how it ended.
function LoginSteps({ login, onRestart }: { login: Login; onRestart: () => void }) {
  const { link, linkText, code, prompt, line, cancel } = useLoginSteps(login);
  return (
    <div className="flex flex-col gap-3 text-sm">
      {link === undefined ? null : (
        <div className="flex flex-col gap-1.5">
          <p>{linkText}</p>
          <a href={link.url} target="_blank" rel="noreferrer" className="break-all text-primary underline">
            {link.url}
          </a>
        </div>
      )}
      {code === undefined ? null : (
        <p>
          Enter <span className="font-mono text-base font-bold">{code.userCode}</span> at{" "}
          <a href={code.verificationUri} target="_blank" rel="noreferrer" className="text-primary underline">
            {code.verificationUri}
          </a>
        </p>
      )}
      {prompt === undefined ? null : <LoginPrompt key={prompt.promptId} loginId={login.id} prompt={prompt} />}
      <LoginOutcome line={line} cancel={cancel} onRestart={onRestart} />
    </div>
  );
}

const LINE_TONES = { muted: "text-muted-foreground", good: "text-primary", bad: "text-destructive" };

// Progress while the sign-in runs, how it ended, and a way to cancel it or start again.
function LoginOutcome({ line, cancel, onRestart }: Pick<SignInSteps, "line" | "cancel"> & { onRestart: () => void }) {
  return (
    <>
      {line === undefined ? null : <p className={LINE_TONES[line.tone]}>{line.text}</p>}
      {cancel === undefined ? (
        <Button variant="text" className="self-start" onClick={onRestart}>
          Start again
        </Button>
      ) : (
        <Button variant="text" className="self-start" onClick={cancel}>
          Cancel sign-in
        </Button>
      )}
    </>
  );
}

function LoginPrompt({ loginId, prompt }: { loginId: string; prompt: NonNullable<SignInSteps["prompt"]> }) {
  const { value, setValue, answer } = useLoginPrompt(loginId, prompt);
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

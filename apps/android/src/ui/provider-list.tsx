import { loginView, providerStatus, type Provider } from "@botsman/client-core";
import { useAction, useBotsmanClient, useLogin, useProviders } from "@botsman/client-core/react";
import * as Linking from "expo-linking";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { fontFamilies, radius, space, useTheme } from "../theme";
import { Button } from "./button";
import { Field } from "./field";
import { ErrorText, Note, pageStyles, Segmented } from "./page";

// Every provider, each opening to its Connect form. Used by the providers screen and first-run setup.
export function ProviderList() {
  const { providers, error } = useProviders();
  const [open, setOpen] = useState<string>();
  return (
    <>
      <ErrorText>{error}</ErrorText>
      {providers === undefined ? <Note>Loading…</Note> : null}
      {providers?.map((provider) => (
        <ProviderRow key={provider.id} provider={provider} open={open === provider.id} onOpen={() => setOpen(open === provider.id ? undefined : provider.id)} />
      ))}
    </>
  );
}

function ProviderRow({ provider, open, onOpen }: { provider: Provider; open: boolean; onOpen: () => void }) {
  const { colors } = useTheme();
  const client = useBotsmanClient();
  const remove = useAction(() => client.disconnectProvider(provider.id));
  return (
    <View style={[styles.card, { borderColor: colors.border }]}>
      <Text style={[pageStyles.rowTitle, { color: colors.foreground }]}>{provider.name}</Text>
      <Text style={[pageStyles.small, { color: provider.connected ? colors.primary : colors.mutedForeground }]}>{providerStatus(provider.connected, provider.connectedWith)}</Text>
      <View style={styles.row}>
        <Button label={open ? "Close" : provider.connected ? "Replace" : "Connect"} variant={provider.connected ? "ghost" : "primary"} onPress={onOpen} />
        {provider.connected ? <Button label="Remove" variant="danger" disabled={remove.busy} onPress={() => void remove.run()} /> : null}
      </View>
      <ErrorText>{remove.error}</ErrorText>
      {open ? <ConnectForm provider={provider} onDone={onOpen} /> : null}
    </View>
  );
}

function ConnectForm({ provider, onDone }: { provider: Provider; onDone: () => void }) {
  const [method, setMethod] = useState(provider.methods[0]!);
  return (
    <View style={styles.group}>
      {provider.methods.length < 2 ? null : (
        <Segmented label="How to connect" options={provider.methods.map((option) => ({ value: option, label: option === "api_key" ? "API key" : (provider.oauthLabel ?? "Sign in") }))} value={method} onChange={setMethod} />
      )}
      {method === "api_key" ? <ApiKeyForm provider={provider} onDone={onDone} /> : <SignIn provider={provider} />}
    </View>
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
    <View style={styles.group}>
      <Field label={`${provider.name} API key`} secureTextEntry value={key} onChangeText={setKey} />
      <ErrorText>{save.error}</ErrorText>
      <Button label="Save key" variant="primary" disabled={key.trim() === "" || save.busy} onPress={() => void save.run()} />
    </View>
  );
}

// A browser sign-in the server runs: open the address, enter any code there, and answer what the provider asks.
function SignIn({ provider }: { provider: Provider }) {
  const { colors } = useTheme();
  const client = useBotsmanClient();
  const [loginId, setLoginId] = useState<string>();
  const login = useLogin(loginId);
  const start = useAction(async () => setLoginId((await client.startLogin(provider.id)).id));
  if (login === undefined)
    return (
      <View style={styles.group}>
        <ErrorText>{start.error}</ErrorText>
        <Button label="Start sign-in" variant="primary" disabled={start.busy} onPress={() => void start.run()} />
      </View>
    );
  const view = loginView(login);
  return (
    <View style={styles.group}>
      {view.link === undefined ? null : (
        <View style={styles.group}>
          <Note>{view.link.instructions ?? "Open this address and sign in."}</Note>
          <Button label="Open in browser" variant="primary" onPress={() => void Linking.openURL(view.link!.url)} />
          <Text selectable style={[pageStyles.small, { color: colors.mutedForeground }]}>
            {view.link.url}
          </Text>
        </View>
      )}
      {view.code === undefined ? null : (
        <View style={styles.group}>
          <Note>Enter this code on the provider's page:</Note>
          <Text selectable style={[styles.code, { color: colors.foreground }]}>
            {view.code.userCode}
          </Text>
          <Button label="Open the page" variant="ghost" onPress={() => void Linking.openURL(view.code!.verificationUri)} />
        </View>
      )}
      {view.prompt === undefined ? null : <LoginPrompt key={view.prompt.promptId} loginId={login.id} prompt={view.prompt} />}
      {view.outcome === "running" && view.progress !== undefined ? <Note>{view.progress}</Note> : null}
      {view.outcome === "connected" ? <Text style={[pageStyles.rowTitle, { color: colors.primary }]}>Connected.</Text> : null}
      {view.outcome === "failed" || view.outcome === "cancelled" ? <ErrorText>{view.error ?? "The sign-in stopped."}</ErrorText> : null}
      {view.outcome === "running" ? <Button label="Cancel sign-in" variant="text" onPress={() => void client.cancelLogin(login.id)} /> : <Button label="Start again" variant="text" onPress={() => setLoginId(undefined)} />}
    </View>
  );
}

function LoginPrompt({ loginId, prompt }: { loginId: string; prompt: NonNullable<ReturnType<typeof loginView>["prompt"]> }) {
  const client = useBotsmanClient();
  const [value, setValue] = useState(prompt.options[0]?.id ?? "");
  const answer = useAction(() => client.answerLogin(loginId, prompt.promptId, value));
  return (
    <View style={styles.group}>
      {prompt.kind === "select" ? (
        <>
          <Note>{prompt.message}</Note>
          <Segmented label={prompt.message} options={prompt.options.map((option) => ({ value: option.id, label: option.label }))} value={value} onChange={setValue} />
        </>
      ) : (
        <Field label={prompt.message} secureTextEntry={prompt.kind === "secret"} placeholder={prompt.placeholder ?? undefined} value={value} onChangeText={setValue} />
      )}
      <ErrorText>{answer.error}</ErrorText>
      <Button label="Continue" variant="primary" disabled={answer.busy} onPress={() => void answer.run()} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.md, padding: space[3], gap: space[2] },
  group: { gap: space[2] },
  row: { flexDirection: "row", gap: space[2] },
  code: { fontFamily: fontFamilies.mono, fontSize: 22, letterSpacing: 2 },
});

import { SHORTEST_PASSWORD } from "@botsman/protocol";
import { useState } from "react";
import type { AppController } from "../app-controller.ts";
import type { BotsmanClient } from "../botsman-client.ts";
import { useAction } from "./use-action.ts";
import { useProviders } from "./use-providers.ts";

// The screens before the main app. Each form's `submit` does nothing until the form is ready, so a keyboard's Enter
// and the button agree.

// Asks for the server's address, starting from the one it last had and why that one failed.
export function useServerForm(app: AppController, lastAddress: string, lastError: string | undefined) {
  const [address, setAddress] = useState(lastAddress);
  const connect = useAction(() => app.connect(address));
  const ready = address.trim() !== "" && !connect.busy;
  return { address, setAddress, ready, error: connect.error ?? lastError, submit: () => void (ready && connect.run()) };
}

// Asks for the owner's password.
export function useSignInForm(client: BotsmanClient) {
  const [password, setPassword] = useState("");
  const signIn = useAction(() => client.session.signIn(password));
  const ready = password !== "" && !signIn.busy;
  return { password, setPassword, ready, error: signIn.error, submit: () => void (ready && signIn.run()) };
}

// First-run setup: the owner's new password and the main bot's name.
export function useSetUpForm(client: BotsmanClient) {
  const [password, setPassword] = useState("");
  const [mainBot, setMainBot] = useState("");
  const name = mainBot.trim();
  const setUp = useAction(() => client.session.setUp(password, { name }));
  const ready = password.length >= SHORTEST_PASSWORD && name !== "" && !setUp.busy;
  return { password, setPassword, passwordHint: `At least ${SHORTEST_PASSWORD} characters.`, mainBot, setMainBot, ready, error: setUp.error, submit: () => void (ready && setUp.run()) };
}

// First run's provider step. It can be skipped, and Continue waits for a connected provider.
export function useProviderStep(app: AppController) {
  const { providers } = useProviders();
  const finish = useAction(() => app.finishSetup());
  const connected = providers?.some((provider) => provider.connected) ?? false;
  return { canSkip: !finish.busy, canContinue: connected && !finish.busy, error: finish.error, finish: () => void finish.run() };
}

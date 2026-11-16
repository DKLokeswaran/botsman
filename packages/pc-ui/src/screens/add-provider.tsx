import type { AppController } from "@botsman/client-core";
import { useAction, useProviders } from "@botsman/client-core/react";
import { ErrorText } from "../components/page.tsx";
import { Button } from "../components/ui/button.tsx";
import { ProviderList } from "./providers.tsx";

// First run, after setup: connect the model provider bots need to run. It can be skipped and done later in Settings.
export function AddProviderScreen({ app }: { app: AppController }) {
  const { providers } = useProviders();
  const connected = providers?.some((provider) => provider.connected) ?? false;
  const finish = useAction(() => app.finishSetup());
  return (
    <main className="mx-auto flex min-h-screen max-w-[560px] flex-col gap-4 px-4 py-10">
      <div className="font-display text-lg tracking-[0.3em] uppercase">Botsman</div>
      <p className="text-xs text-muted-foreground">Step 2 of 2</p>
      <h1 className="font-display text-2xl font-bold uppercase leading-snug">Add a model provider</h1>
      <p className="text-sm text-muted-foreground">Bots need one provider to run. Its key or sign-in is stored only on the server, and it can't be viewed after saving.</p>
      <ProviderList />
      <ErrorText>{finish.error}</ErrorText>
      <div className="flex items-center justify-end gap-2">
        <Button variant="text" disabled={finish.busy} onClick={() => void finish.run()}>
          Skip for now
        </Button>
        <Button variant="primary" disabled={!connected || finish.busy} onClick={() => void finish.run()}>
          Continue
        </Button>
      </div>
    </main>
  );
}

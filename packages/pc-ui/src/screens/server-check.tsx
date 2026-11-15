import { useServerHealth } from "@botsman/client-core/react";
import { type FormEvent, useState } from "react";
import type { Platform } from "../platform.ts";

// Asks for a server address and shows whether a Botsman server answers there.
export function ServerCheckScreen({ platform }: { platform: Platform }) {
  const [address, setAddress] = useState(platform.homeServer ?? "");
  const { state, check } = useServerHealth(platform.fetch);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void check(address);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-[var(--reading-width)] flex-col justify-center gap-6 p-6">
      <h1 className="font-display text-[40px] font-black uppercase leading-tight">Botsman</h1>
      <p className="text-muted-foreground">Enter the address of your Botsman server.</p>
      <form onSubmit={submit} className="flex gap-2">
        <input
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:border-ring"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="bots.example.com"
          aria-label="Server address"
        />
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50" disabled={state.status === "checking"}>
          Check
        </button>
      </form>
      <ServerCheckResult state={state} />
    </main>
  );
}

function ServerCheckResult({ state }: { state: ReturnType<typeof useServerHealth>["state"] }) {
  if (state.status === "idle") return null;
  if (state.status === "checking") return <p className="text-muted-foreground">Checking…</p>;
  if (state.status === "failed") return <p className="text-destructive">{state.message}</p>;
  return (
    <dl className="rounded-lg border border-border bg-card p-4 font-mono text-sm">
      <Row label="Server" value={state.baseUrl} />
      <Row label="Version" value={state.health.version} />
      <Row label="Sandboxes" value={state.health.sandbox.ok ? "Working" : (state.health.sandbox.reason ?? "Not working")} />
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-green">{value}</dd>
    </div>
  );
}

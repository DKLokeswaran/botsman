import type { FormEvent, ReactNode } from "react";

// The centred card the screens before the main app share: server address, setup, sign-in, and update notices.
export function EntryCard({ title, lede, error, onSubmit, children }: { title: string; lede: string; error?: string | undefined; onSubmit?: () => void; children: ReactNode }) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit?.();
  };
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-4 rounded-xl border border-border bg-card p-6">
        <div className="font-display text-xl tracking-[0.3em] uppercase">Botsman</div>
        <h1 className="font-display text-2xl font-bold uppercase leading-snug">{title}</h1>
        <p className="text-sm text-muted-foreground">{lede}</p>
        {children}
        {error === undefined ? null : (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
    </main>
  );
}

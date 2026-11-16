import type { ReactNode } from "react";

// A settings-style page beside the bot list: a header with a back link, then a narrow column.
export function Page({ title, subtitle, back, children }: { title: string; subtitle?: string; back: string; children: ReactNode }) {
  return (
    <section className="flex h-full min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <a href={back} aria-label="Back" className="rounded-lg px-2 text-xl hover:bg-accent">
          ‹
        </a>
        <div className="min-w-0">
          <h1 className="truncate font-display text-base font-bold uppercase">{title}</h1>
          {subtitle === undefined ? null : <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[560px] flex-col gap-4 px-4 py-6">{children}</div>
      </div>
    </section>
  );
}

// A row that opens another page.
export function LinkRow({ href, title, detail }: { href: string; title: string; detail: string }) {
  return (
    <a href={href} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 hover:bg-accent">
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
      <span aria-hidden>›</span>
    </a>
  );
}

// An on or off switch with a label and a line of detail.
export function ToggleRow({ title, detail, on, onChange, disabled = false }: { title: string; detail: string; on: boolean; onChange: (on: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
      <input type="checkbox" role="switch" className="size-4 accent-[var(--color-primary)]" checked={on} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

export function ErrorText({ children }: { children: string | undefined }) {
  return children === undefined ? null : <p className="text-sm text-destructive">{children}</p>;
}

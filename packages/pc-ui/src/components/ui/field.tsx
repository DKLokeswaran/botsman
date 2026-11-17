import { type InputHTMLAttributes, useId } from "react";

// A labelled text input.
export function Field({ label, hint, className = "", ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        className={`rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring ${className}`}
        {...rest}
      />
      {hint === undefined ? null : <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

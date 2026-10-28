import * as React from "react";
import { cn } from "../../lib/utils";

export function Button({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-[3px] bg-[var(--btn)] px-3 font-[family-name:var(--font-label)] text-[12px] font-semibold tracking-[0.08em] text-[var(--fg)] uppercase disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

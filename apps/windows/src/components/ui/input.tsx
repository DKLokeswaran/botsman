import * as React from "react";
import { cn } from "../../lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-[4px] border border-[var(--line)] bg-[var(--bg-2)] px-3 text-[16px] text-[var(--fg)] outline-none focus:ring-1 focus:ring-[var(--accent)]",
        className,
      )}
      {...props}
    />
  );
}

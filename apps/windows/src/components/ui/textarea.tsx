import * as React from "react";
import { cn } from "../../lib/utils";

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-20 w-full rounded-[4px] border border-[var(--line)] bg-[var(--bg-2)] px-3 py-2 text-[16px] text-[var(--fg)] outline-none focus:ring-1 focus:ring-[var(--accent)]",
        className,
      )}
      {...props}
    />
  );
}

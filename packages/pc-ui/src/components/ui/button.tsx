import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "text" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  ghost: "border border-border bg-transparent text-foreground hover:bg-accent",
  text: "bg-transparent text-foreground hover:bg-accent",
  danger: "border border-destructive bg-transparent text-destructive hover:bg-accent",
};

// The app's button. Zoetrik keeps corners at 4 pixels and uses no shadows or gradients on controls.
export function Button({ variant = "ghost", className = "", type = "button", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}

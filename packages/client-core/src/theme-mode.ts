// How an app picks its colours: follow the device, or always light or dark. Each device keeps its own choice.
export type ThemeMode = "system" | "light" | "dark";

export const THEME_MODES: readonly { mode: ThemeMode; label: string }[] = [
  { mode: "system", label: "System" },
  { mode: "light", label: "Light" },
  { mode: "dark", label: "Dark" },
];

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

// The palette to use: Zoetrik dark or its Drafting Table light scheme.
export function resolveTheme(mode: ThemeMode, systemDark: boolean): "dark" | "light" {
  if (mode === "system") return systemDark ? "dark" : "light";
  return mode;
}

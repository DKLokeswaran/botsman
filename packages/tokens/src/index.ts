// The Zoetrik look as data. `pc-ui` reads it as CSS variables, and the Android app reads the objects directly.

export type Palette = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  green: string;
  cyan: string;
  blue: string;
  mint: string;
  magenta: string;
};

export type ThemeName = "dark" | "light";

// Dark is the Zoetrik palette. Light is its Drafting Table scheme.
export const palettes: Record<ThemeName, Palette> = {
  dark: {
    background: "#000000",
    foreground: "#ffffff",
    card: "#111111",
    cardForeground: "#ffffff",
    popover: "#111111",
    popoverForeground: "#ffffff",
    primary: "#ffa41c",
    primaryForeground: "#000000",
    secondary: "#171717",
    secondaryForeground: "#ffffff",
    muted: "#171717",
    mutedForeground: "#999999",
    accent: "#171717",
    accentForeground: "#ffffff",
    destructive: "#f87171",
    destructiveForeground: "#000000",
    border: "#262626",
    input: "#262626",
    ring: "#ffa41c",
    green: "#71ff19",
    cyan: "#19f2ff",
    blue: "#0099ff",
    mint: "#78facb",
    magenta: "#c8287f",
  },
  light: {
    background: "#f2f0eb",
    foreground: "#111111",
    card: "#e8e5de",
    cardForeground: "#111111",
    popover: "#e8e5de",
    popoverForeground: "#111111",
    primary: "#d9480f",
    primaryForeground: "#ffffff",
    secondary: "#dedcd7",
    secondaryForeground: "#111111",
    muted: "#dedcd7",
    mutedForeground: "#595856",
    accent: "#dedcd7",
    accentForeground: "#111111",
    destructive: "#dc2626",
    destructiveForeground: "#ffffff",
    border: "#d4d0c6",
    input: "#d4d0c6",
    ring: "#d9480f",
    green: "#146b12",
    cyan: "#0b6e78",
    blue: "#1f6fe0",
    mint: "#0f6b52",
    magenta: "#a01f66",
  },
};

export const fonts = {
  display: "Orbitron",
  body: "Inter",
  mono: "Fragment Mono",
} as const;

export const radius = { md: 4, lg: 8 } as const;

// The 4-pixel spacing scale.
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 64, 8: 128 } as const;

// Reading width of a chat column, in pixels.
export const readingWidth = 720;

// The CSS variable name for a palette key, such as `--card-foreground`.
export function cssVariable(key: keyof Palette): string {
  return `--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

// The stylesheet `pc-ui` loads: dark on `:root`, light under `[data-theme="light"]`.
export function themeCss(): string {
  const block = (selector: string, palette: Palette, extra: string[] = []) => {
    const lines = (Object.keys(palette) as (keyof Palette)[]).map((key) => `  ${cssVariable(key)}: ${palette[key]};`);
    return `${selector} {\n${[...lines, ...extra].join("\n")}\n}\n`;
  };
  const shared = [
    `  --radius: ${radius.md}px;`,
    `  --radius-large: ${radius.lg}px;`,
    `  --font-display: "${fonts.display}", sans-serif;`,
    `  --font-body: "${fonts.body}", system-ui, sans-serif;`,
    `  --font-mono: "${fonts.mono}", ui-monospace, monospace;`,
    `  --reading-width: ${readingWidth}px;`,
  ];
  return `/* Generated from src/index.ts by scripts/write-theme-css.ts. */\n${block(":root", palettes.dark, shared)}\n${block('[data-theme="light"]', palettes.light)}`;
}
export * from "./marks.ts";

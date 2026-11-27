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

// Every font file the apps ship, from the fonts folder. Android knows each font by its file name.
export const fontFaces = {
  displayRegular: { family: fonts.display, weight: 400, file: "Orbitron_400Regular" },
  display: { family: fonts.display, weight: 700, file: "Orbitron_700Bold" },
  displayBlack: { family: fonts.display, weight: 900, file: "Orbitron_900Black" },
  body: { family: fonts.body, weight: 400, file: "Inter_400Regular" },
  bodyMedium: { family: fonts.body, weight: 500, file: "Inter_500Medium" },
  bodySemiBold: { family: fonts.body, weight: 600, file: "Inter_600SemiBold" },
  mono: { family: fonts.mono, weight: 400, file: "FragmentMono_400Regular" },
} as const;

type FontFace = (typeof fontFaces)[keyof typeof fontFaces];

// Where each font file is, from the tokens package's folder.
const fontPath = (face: FontFace) => `fonts/${face.file}.ttf`;

// Every font file's path, from the tokens package's folder, for builds that embed the files.
export const fontFiles = Object.values(fontFaces).map(fontPath);

export const radius = { md: 4, lg: 8 } as const;

// The 4-pixel spacing scale.
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 64, 8: 128 } as const;

// Reading width of a chat column, in pixels.
export const readingWidth = 720;

// The CSS variable name for a palette key, such as `--card-foreground`.
export function cssVariable(key: keyof Palette): string {
  return `--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

// The CSS rule that loads one font file. It covers every character in the file.
function fontFaceCss(face: FontFace): string {
  const lines = [
    `  font-family: "${face.family}";`,
    "  font-style: normal;",
    `  font-weight: ${face.weight};`,
    "  font-display: swap;",
    `  src: url("./${fontPath(face)}") format("truetype");`,
  ];
  return `@font-face {\n${lines.join("\n")}\n}\n`;
}

// The stylesheet `pc-ui` loads: the font files, then dark on `:root`, light under `[data-theme="light"]`.
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
  const faces = Object.values(fontFaces).map(fontFaceCss).join("\n");
  return `/* Generated from src/index.ts by scripts/write-theme-css.ts. */\n${faces}\n${block(":root", palettes.dark, shared)}\n${block('[data-theme="light"]', palettes.light)}`;
}
export * from "./marks.ts";

import { resolveTheme, type ThemeMode } from "@botsman/client-core";
import { fontFaces, type Palette, palettes, radius, space } from "@botsman/tokens";
import { createContext, useContext } from "react";
import { useColorScheme } from "react-native";

// The font files the build embeds, named as Android knows them.
export const fontFamilies = {
  display: fontFaces.display.file,
  displayBlack: fontFaces.displayBlack.file,
  body: fontFaces.body.file,
  bodyMedium: fontFaces.bodyMedium.file,
  bodySemiBold: fontFaces.bodySemiBold.file,
  mono: fontFaces.mono.file,
} as const;

export type Theme = { colors: Palette; dark: boolean };

// This phone's theme choice and the way to change it, from the root layout.
export const ThemeModeContext = createContext<[ThemeMode, (mode: ThemeMode) => void]>(["system", () => {}]);

// Zoetrik dark, or its Drafting Table light scheme: the owner's choice, or the phone's setting under System.
export function useTheme(): Theme {
  const [mode] = useContext(ThemeModeContext);
  const dark = resolveTheme(mode, useColorScheme() !== "light") === "dark";
  return { colors: dark ? palettes.dark : palettes.light, dark };
}

export function useThemeMode(): [ThemeMode, (mode: ThemeMode) => void] {
  return useContext(ThemeModeContext);
}

export { radius, space };

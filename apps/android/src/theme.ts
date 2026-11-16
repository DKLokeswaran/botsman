import { type Palette, palettes, radius, space } from "@botsman/tokens";
import { useColorScheme } from "react-native";

// The font files the build embeds, named as Android knows them.
export const fontFamilies = {
  display: "Orbitron_700Bold",
  displayBlack: "Orbitron_900Black",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemiBold: "Inter_600SemiBold",
  mono: "FragmentMono_400Regular",
} as const;

export type Theme = { colors: Palette; dark: boolean };

// Zoetrik dark, or its Drafting Table light scheme, following the phone's setting.
export function useTheme(): Theme {
  const dark = useColorScheme() !== "light";
  return { colors: dark ? palettes.dark : palettes.light, dark };
}

export { radius, space };

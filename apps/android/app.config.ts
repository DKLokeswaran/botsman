import { fontFaces } from "@botsman/tokens";
import type { ConfigContext, ExpoConfig } from "expo/config";

const fonts = Object.values(fontFaces).map((face) => `../../packages/tokens/fonts/${face.file}.ttf`);

// Adds the shared font files to the settings in app.json, so the build embeds every file the tokens list.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [...(config.plugins ?? []), ["expo-font", { fonts }]],
});

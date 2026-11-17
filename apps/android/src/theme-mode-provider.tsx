import { isThemeMode, type ThemeMode } from "@botsman/client-core";
import * as SecureStore from "expo-secure-store";
import { type ReactNode, useEffect, useState } from "react";
import { ThemeModeContext } from "./theme";

const KEY = "botsman.theme";

// Holds this phone's theme choice, kept in the phone's storage.
export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("system");
  useEffect(() => {
    void SecureStore.getItemAsync(KEY).then((value) => isThemeMode(value) && setMode(value), () => undefined);
  }, []);
  const choose = (next: ThemeMode) => {
    setMode(next);
    void SecureStore.setItemAsync(KEY, next).catch(() => undefined);
  };
  return <ThemeModeContext.Provider value={[mode, choose]}>{children}</ThemeModeContext.Provider>;
}

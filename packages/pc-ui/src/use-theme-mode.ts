import { isThemeMode, resolveTheme, type ThemeMode } from "@botsman/client-core";
import { useEffect, useState } from "react";

const KEY = "botsman.theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function storedMode(): ThemeMode {
  try {
    const value = localStorage.getItem(KEY);
    return isThemeMode(value) ? value : "system";
  } catch {
    return "system";
  }
}

// The theme choice for this device, kept in local storage, and applied to the page as `data-theme`, following the
// system's light or dark setting when the choice is System.
export function useThemeMode(): [ThemeMode, (mode: ThemeMode) => void] {
  const [mode, setMode] = useState<ThemeMode>(storedMode);
  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const apply = () => (document.documentElement.dataset.theme = resolveTheme(mode, query.matches));
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [mode]);
  const choose = (next: ThemeMode) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // The choice still applies until the page reloads.
    }
    setMode(next);
  };
  return [mode, choose];
}

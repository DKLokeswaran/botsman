import { useCallback, useEffect, useState } from "react";

export type Loaded<T> = { value: T | undefined; error: string | undefined; reload: () => void };

// Loads something from the server when its inputs change, and on `reload`.
export function useLoaded<T>(load: () => Promise<T>, inputs: readonly unknown[], delayMs = 0): Loaded<T> {
  const [value, setValue] = useState<T>();
  const [error, setError] = useState<string>();
  const [round, setRound] = useState(0);
  const reload = useCallback(() => setRound((current) => current + 1), []);
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      load()
        .then((result) => current && (setValue(result), setError(undefined)))
        .catch((caught: unknown) => current && setError(caught instanceof Error ? caught.message : "Couldn't load"));
    }, delayMs);
    return () => {
      current = false;
      clearTimeout(timer);
    };
    // Loads again only when an input changes or on `reload`. A new `load` on each render doesn't reload.
  }, [...inputs, round]);
  return { value, error, reload };
}

import { useCallback, useRef, useState } from "react";

export type Action<Args extends unknown[]> = {
  run: (...args: Args) => Promise<boolean>;
  busy: boolean;
  error: string | undefined;
};

// Wraps something the owner starts, such as signing in, so a screen can show that it is running and why it failed.
// `run` answers whether it worked.
export function useAction<Args extends unknown[]>(work: (...args: Args) => Promise<unknown>): Action<Args> {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const latest = useRef(work);
  latest.current = work;

  const run = useCallback(async (...args: Args) => {
    setBusy(true);
    setError(undefined);
    try {
      await latest.current(...args);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return { run, busy, error };
}

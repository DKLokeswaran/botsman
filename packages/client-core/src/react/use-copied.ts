import { useState } from "react";

const COPIED_MS = 1500;

// Copies text with the app's own clipboard, and says so for a moment after.
export function useCopied(write: (text: string) => Promise<unknown>): { copied: boolean; copy: (text: string) => Promise<void> } {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    await write(text);
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_MS);
  };
  return { copied, copy };
}

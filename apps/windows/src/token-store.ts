import type { TokenStore, Tokens } from "@botsman/client-core";
import { invoke } from "@tauri-apps/api/core";

// The session's tokens, kept in Windows Credential Manager by the Rust side.
export const tokenStore: TokenStore = {
  load: async () => {
    const stored = await invoke<string | null>("load_tokens");
    return stored === null ? undefined : (JSON.parse(stored) as Tokens);
  },
  save: (tokens) => invoke("save_tokens", { tokens: JSON.stringify(tokens) }),
  clear: () => invoke("clear_tokens"),
};

import { installBridge } from "./bridge";

installBridge();

const VAULT_KEY = "hermes-e2e-vault";

/** In-memory stand-in for the Tauri commands the Windows shell exposes. */
export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (command === "vault_load") {
    return (localStorage.getItem(VAULT_KEY) as T) ?? (null as T);
  }
  if (command === "vault_save") {
    const payload = String(args?.payload ?? "");
    JSON.parse(payload);
    localStorage.setItem(VAULT_KEY, payload);
    return undefined as T;
  }
  if (command === "vault_clear_secret") {
    const raw = localStorage.getItem(VAULT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      parsed.refreshToken = "";
      localStorage.setItem(VAULT_KEY, JSON.stringify(parsed));
    }
    return undefined as T;
  }
  if (command === "apply_update") {
    throw new Error("The installer is a Windows exe.");
  }
  throw new Error(`e2e shim has no command ${command}`);
}

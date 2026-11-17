import { createContext, type ReactNode, useContext } from "react";
import type { BotsmanClient } from "../botsman-client.ts";

const ClientContext = createContext<BotsmanClient | undefined>(undefined);

// Gives the screens below it the client for the server the app is connected to.
export function BotsmanProvider({ client, children }: { client: BotsmanClient; children: ReactNode }) {
  return <ClientContext.Provider value={client}>{children}</ClientContext.Provider>;
}

export function useBotsmanClient(): BotsmanClient {
  const client = useContext(ClientContext);
  if (client === undefined) throw new Error("useBotsmanClient needs a BotsmanProvider above it");
  return client;
}

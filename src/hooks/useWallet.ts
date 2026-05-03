import { useCallback, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export interface ConnectorOption {
  id: string;
  name: string;
  icon?: string;
  connect: () => Promise<void>;
}

export function useWallet() {
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [error, setError] = useState<string | null>(null);

  /**
   * Connect with a specific connector by id.
   * Falls back to the first available connector if no id is given.
   */
  const connectWallet = useCallback(
    async (connectorId?: string) => {
      setError(null);

      const connector = connectorId
        ? connectors.find((c) => c.id === connectorId) ?? connectors[0]
        : // Prefer injected if available, otherwise first in list
          connectors.find((c) => c.id === "injected") ?? connectors[0];

      if (!connector) {
        const message = "No wallet connector is configured.";
        setError(message);
        throw new Error(message);
      }

      try {
        await connectAsync({ connector });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Wallet connection failed.";
        // Suppress user-rejected errors silently
        if (!message.toLowerCase().includes("rejected")) {
          setError(message);
        }
        throw err;
      }
    },
    [connectAsync, connectors]
  );

  /**
   * All available connectors as a typed list for rendering a picker UI.
   */
  const connectorOptions: ConnectorOption[] = connectors.map((c) => ({
    id: c.id,
    name: c.name,
    icon: (c as { icon?: string }).icon,
    connect: () => connectWallet(c.id),
  }));

  return {
    address,
    isConnected,
    isPending,
    error,
    connectorOptions,
    connectWallet,
    disconnect,
  };
}

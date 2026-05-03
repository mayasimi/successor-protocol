import { useCallback, useMemo, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export function useWallet() {
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [error, setError] = useState<string | null>(null);

  const connector = useMemo(
    () =>
      connectors.find((item) => item.id === "injected") ??
      connectors.find((item) => item.type === "injected") ??
      connectors[0],
    [connectors]
  );

  const connectWallet = useCallback(async () => {
    setError(null);

    const hasInjectedWallet =
      typeof window !== "undefined" &&
      Boolean((window as Window & { ethereum?: unknown }).ethereum);

    if (!hasInjectedWallet) {
      const message = "No browser wallet found. Install MetaMask or another injected wallet.";
      setError(message);
      throw new Error(message);
    }

    if (!connector) {
      const message = "No wallet connector is configured.";
      setError(message);
      throw new Error(message);
    }

    try {
      await connectAsync({ connector });
    } catch (connectError) {
      const message =
        connectError instanceof Error
          ? connectError.message
          : "Wallet connection failed.";
      setError(message);
      throw connectError;
    }
  }, [connectAsync, connector]);

  return {
    address,
    isConnected,
    isPending,
    error,
    connectWallet,
    disconnect,
  };
}

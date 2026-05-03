"use client";

import { Button } from "@/components/ui/Button";
import { useWallet } from "@/hooks/useWallet";
import { truncateAddress } from "@/lib/utils";

export function WalletButton() {
  const { address, isConnected, isPending, error, connectWallet, disconnect } =
    useWallet();

  const handleConnect = async () => {
    try {
      await connectWallet();
    } catch {
      // The hook stores a user-facing error below the button.
    }
  };

  if (isConnected && address) {
    return (
      <Button
        variant="secondary"
        onClick={() => disconnect()}
        aria-label="Disconnect wallet"
      >
        {truncateAddress(address)}
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        onClick={handleConnect}
        aria-label="Connect wallet"
        disabled={isPending}
        isLoading={isPending}
      >
        {isPending ? "Connecting" : "Connect Wallet"}
      </Button>
      {error && (
        <p className="max-w-64 text-right text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}

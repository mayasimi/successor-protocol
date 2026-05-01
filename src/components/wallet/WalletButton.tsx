"use client";

import { Button } from "@/components/ui/Button";
import { useWallet } from "@/hooks/useWallet";
import { truncateAddress } from "@/lib/utils";

export function WalletButton() {
  const { address, isConnected, connectWallet, disconnect } = useWallet();

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
    <Button onClick={connectWallet} aria-label="Connect wallet">
      Connect Wallet
    </Button>
  );
}

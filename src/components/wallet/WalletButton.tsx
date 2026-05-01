"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "@wagmi/connectors";
import { Button } from "@/components/ui/Button";
import { shortenAddress } from "@/lib/utils";

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => disconnect()}
        aria-label="Disconnect wallet"
      >
        {shortenAddress(address)}
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      onClick={() => connect({ connector: injected() })}
      aria-label="Connect wallet"
    >
      Connect Wallet
    </Button>
  );
}

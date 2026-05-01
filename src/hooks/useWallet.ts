"use client";

import { useAccount, useDisconnect, useBalance } from "wagmi";
import { shortenAddress } from "@/lib/utils";

export function useWallet() {
  const { address, isConnected, chain } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });

  return {
    address,
    shortAddress: address ? shortenAddress(address) : null,
    isConnected,
    chain,
    balance,
    disconnect,
  };
}

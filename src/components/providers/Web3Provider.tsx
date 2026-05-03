"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { injected } from "wagmi/connectors";

export const kiteTestnet = defineChain({
  id: 2368,
  name: "KiteAI Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "KITE",
    symbol: "KITE",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc-testnet.gokite.ai/"],
    },
  },
  blockExplorers: {
    default: {
      name: "KiteScan",
      url: "https://testnet.kitescan.ai",
    },
  },
  testnet: true,
});

const config = createConfig({
  chains: [kiteTestnet],
  connectors: [
    injected({
      shimDisconnect: true,
    }),
  ],
  transports: {
    [kiteTestnet.id]: http("https://rpc-testnet.gokite.ai/"),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

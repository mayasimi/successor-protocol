"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { injected, walletConnect, coinbaseWallet } from "wagmi/connectors";

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

// WalletConnect project ID – get a free one at https://cloud.walletconnect.com
const WC_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "successor-protocol-dev";

function makeConfig() {
  return createConfig({
    chains: [kiteTestnet],
    connectors: [
      injected({ shimDisconnect: true }),
      walletConnect({
        projectId: WC_PROJECT_ID,
        metadata: {
          name: "Successor Protocol",
          description: "Autonomous on-chain will executor",
          url: "https://successor.protocol",
          icons: ["https://successor.protocol/icon.png"],
        },
        showQrModal: true,
      }),
      coinbaseWallet({
        appName: "Successor Protocol",
      }),
    ],
    transports: {
      [kiteTestnet.id]: http("https://rpc-testnet.gokite.ai/"),
    },
    ssr: true,
  });
}

export function Web3Provider({ children }: { children: React.ReactNode }) {
  // useState ensures config + QueryClient are created once per client mount,
  // never on the server — this eliminates the "Provider not found" SSR error.
  const [config] = useState(() => makeConfig());
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

import "server-only";

export type KiteNetwork = "mainnet" | "testnet" | "mock";
export type KiteProviderMode = "mock" | "live";

export interface KiteConfig {
  mode: KiteProviderMode;
  network: KiteNetwork;
  chainId: number;
  rpcUrl: string;
  blockExplorerUrl: string;
  passportMcpUrl: string;
  passportPortalUrl: string;
  agentId: string;
  privateKey?: `0x${string}`;
  attestationContractAddress?: `0x${string}`;
  usdcTokenAddress?: `0x${string}`;
}

function normalizeNetwork(value?: string): KiteNetwork {
  if (value === "mainnet" || value === "testnet" || value === "mock") {
    return value;
  }

  return "testnet";
}

function normalizeMode(value?: string): KiteProviderMode {
  if (value === "live" || value === "mock") {
    return value;
  }

  return process.env.KITE_AGENT_PRIVATE_KEY ? "live" : "mock";
}

function maybeAddress(value?: string): `0x${string}` | undefined {
  return value?.match(/^0x[a-fA-F0-9]{40}$/) ? (value as `0x${string}`) : undefined;
}

function maybePrivateKey(value?: string): `0x${string}` | undefined {
  return value?.match(/^0x[a-fA-F0-9]{64}$/) ? (value as `0x${string}`) : undefined;
}

export function getKiteConfig(): KiteConfig {
  const network = normalizeNetwork(process.env.KITE_NETWORK);
  const mode = normalizeMode(process.env.KITE_PROVIDER_MODE);
  const isMainnet = network === "mainnet";
  const isMock = network === "mock";
  const chainId = Number(
    process.env.KITE_CHAIN_ID ?? (isMock ? 0 : isMainnet ? 2366 : 2368)
  );

  return {
    mode,
    network,
    chainId,
    rpcUrl:
      process.env.KITE_RPC_URL ??
      (isMainnet ? "https://rpc.gokite.ai/" : "https://rpc-testnet.gokite.ai/"),
    blockExplorerUrl:
      process.env.KITE_BLOCK_EXPLORER_URL ??
      (isMainnet ? "https://kitescan.ai" : "https://testnet.kitescan.ai"),
    passportMcpUrl:
      process.env.KITE_AGENT_PASSPORT_MCP_URL ??
      "https://neo.dev.gokite.ai/v1/mcp",
    passportPortalUrl:
      process.env.KITE_PASSPORT_PORTAL_URL ??
      "https://x402-portal-eight.vercel.app/",
    agentId:
      process.env.KITE_AGENT_ID ??
      "did:kite:successor-protocol/dead-mans-agent-v1",
    privateKey: maybePrivateKey(process.env.KITE_AGENT_PRIVATE_KEY),
    attestationContractAddress: maybeAddress(
      process.env.KITE_ATTESTATION_CONTRACT_ADDRESS
    ),
    usdcTokenAddress: maybeAddress(process.env.KITE_USDC_TOKEN_ADDRESS),
  };
}

export function getDataFilePath() {
  return process.env.SUCCESSOR_DATA_PATH ?? ".successor-data/state.json";
}

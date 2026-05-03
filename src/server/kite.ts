import "server-only";

import {
  createWalletClient,
  http,
  parseUnits,
  type Chain,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { getKiteConfig, getSuccessorContractAddress } from "./config";
import { addHoursIso, makeId, makeTxHash, nowIso, sha256Hex } from "./crypto";
import type {
  Attestation,
  EstatePlan,
  InstructionResult,
  KitePassportSession,
  TransferUsdcInstruction,
} from "./types";

const erc20Abi = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const attestorAbi = [
  {
    type: "function",
    name: "attest",
    stateMutability: "nonpayable",
    inputs: [
      { name: "payloadHash", type: "bytes32" },
      { name: "action", type: "string" },
      { name: "planId", type: "string" },
      { name: "subjectId", type: "string" },
    ],
    outputs: [{ name: "attestationId", type: "bytes32" }],
  },
] as const;

export interface KiteReceipt {
  provider: "kite" | "mock";
  txHash: string;
  chainId: number;
  network: "mainnet" | "testnet" | "mock";
  explorerUrl?: string;
  metadata: Record<string, unknown>;
}

export async function createPassportSession(
  plan: EstatePlan
): Promise<KitePassportSession> {
  const config = getKiteConfig();
  const expiresAt = addHoursIso(nowIso(), plan.spendingPolicy.sessionDurationHours);

  return {
    sessionId: makeId("kite_session"),
    delegationId: makeId("kite_delegation"),
    agentId: plan.agentId,
    userDid: `did:kite:${plan.ownerWallet.toLowerCase()}`,
    maxBudgetUsdc: plan.spendingPolicy.totalBudgetUsdc,
    perTransactionLimitUsdc: plan.spendingPolicy.perTransferLimitUsdc,
    expiresAt,
    status: config.mode === "live" ? "active" : "mock",
    approvalUrl: config.passportPortalUrl,
    network: config.network,
  };
}

export async function submitAttestation(
  attestation: Pick<
    Attestation,
    "payloadHash" | "action" | "planId" | "subjectId"
  >
): Promise<KiteReceipt> {
  const config = getKiteConfig();

  if (config.mode !== "live") {
    return mockReceipt("attestation", {
      payloadHash: attestation.payloadHash,
      action: attestation.action,
    });
  }

  if (!config.privateKey || !config.attestationContractAddress) {
    throw new Error(
      "Kite live mode requires KITE_AGENT_PRIVATE_KEY and KITE_ATTESTATION_CONTRACT_ADDRESS"
    );
  }

  const client = createKiteWalletClient();
  const txHash = await client.writeContract({
    address: config.attestationContractAddress,
    abi: attestorAbi,
    functionName: "attest",
    args: [
      attestation.payloadHash,
      attestation.action,
      attestation.planId,
      attestation.subjectId ?? "",
    ],
  });

  return liveReceipt(txHash, { kind: "attestation" });
}

export async function transferUsdc(
  plan: EstatePlan,
  instruction: TransferUsdcInstruction
): Promise<InstructionResult> {
  const config = getKiteConfig();

  if (config.mode !== "live") {
    const receipt = mockReceipt("transfer_usdc", {
      planId: plan.id,
      instructionId: instruction.id,
      amountUsdc: instruction.amountUsdc,
      recipientWallet: instruction.recipientWallet,
    });

    return {
      provider: "mock",
      txHash: receipt.txHash,
      proof: receipt.metadata.proof as string,
      message: `Mock Kite transfer of ${instruction.amountUsdc} USDC queued for ${instruction.recipientWallet}`,
      metadata: receipt.metadata,
    };
  }

  if (!config.privateKey || !config.usdcTokenAddress) {
    throw new Error(
      "Kite live mode requires KITE_AGENT_PRIVATE_KEY and KITE_USDC_TOKEN_ADDRESS for USDC transfers"
    );
  }

  const client = createKiteWalletClient();
  const txHash = await client.writeContract({
    address: config.usdcTokenAddress,
    abi: erc20Abi,
    functionName: "transfer",
    args: [
      instruction.recipientWallet,
      parseUnits(String(instruction.amountUsdc), 6),
    ],
  });

  return {
    provider: "kite",
    txHash,
    message: `Transferred ${instruction.amountUsdc} USDC to ${instruction.recipientWallet}`,
    metadata: {
      chainId: config.chainId,
      network: config.network,
      explorerUrl: `${config.blockExplorerUrl}/tx/${txHash}`,
    },
  };
}

function createKiteWalletClient() {
  const config = getKiteConfig();

  if (!config.privateKey) {
    throw new Error("KITE_AGENT_PRIVATE_KEY is required for Kite live mode");
  }

  const account = privateKeyToAccount(config.privateKey);
  const chain: Chain = {
    id: config.chainId,
    name: config.network === "mainnet" ? "KiteAI Mainnet" : "KiteAI Testnet",
    nativeCurrency: { name: "KITE", symbol: "KITE", decimals: 18 },
    rpcUrls: {
      default: { http: [config.rpcUrl] },
      public: { http: [config.rpcUrl] },
    },
    blockExplorers: {
      default: { name: "KiteScan", url: config.blockExplorerUrl },
    },
  };

  return createWalletClient({
    account,
    chain,
    transport: http(config.rpcUrl),
  });
}

function mockReceipt(
  kind: string,
  payload: Record<string, unknown>
): KiteReceipt {
  const config = getKiteConfig();
  const txHash = makeTxHash();

  return {
    provider: "mock",
    txHash,
    chainId: config.chainId,
    network: config.network === "mock" ? "mock" : config.network,
    explorerUrl:
      config.network === "mock" ? undefined : `${config.blockExplorerUrl}/tx/${txHash}`,
    metadata: {
      kind,
      proof: `sha256:${sha256Hex({ kind, payload, txHash })}`,
      simulatedAt: nowIso(),
    },
  };
}

function liveReceipt(txHash: Hash, metadata: Record<string, unknown>): KiteReceipt {
  const config = getKiteConfig();

  return {
    provider: "kite",
    txHash,
    chainId: config.chainId,
    network: config.network,
    explorerUrl: `${config.blockExplorerUrl}/tx/${txHash}`,
    metadata,
  };
}

// ─── Successor.sol contract integration ──────────────────────────────────────

/**
 * Minimal ABI slice for the Successor contract – server-side only.
 * The full ABI lives in src/lib/contracts.ts for the frontend.
 */
const successorAbi = [
  {
    type: "function",
    name: "ping",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "verifyDeath",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "executeAll",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "addInstruction",
    stateMutability: "nonpayable",
    inputs: [
      { name: "target", type: "address" },
      { name: "data", type: "bytes" },
      { name: "value", type: "uint256" },
      { name: "description", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getStatus",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "triggered", type: "bool" },
      { name: "currentState", type: "uint8" },
      { name: "timeRemaining", type: "uint256" },
      { name: "totalInstructions", type: "uint256" },
    ],
  },
] as const;

/**
 * Sends a heartbeat ping to the Successor contract from the agent wallet.
 * Used by the backend agent when recording a server-side heartbeat.
 * Falls back to a mock receipt when the contract address is not configured.
 */
export async function pingSuccessorContract(): Promise<KiteReceipt> {
  const config = getKiteConfig();
  const contractAddress = getSuccessorContractAddress();

  if (config.mode !== "live" || !contractAddress || !config.privateKey) {
    return mockReceipt("successor.ping", { contractAddress });
  }

  const client = createKiteWalletClient();
  const txHash = await client.writeContract({
    address: contractAddress,
    abi: successorAbi,
    functionName: "ping",
  });

  return liveReceipt(txHash, { kind: "successor.ping", contractAddress });
}

/**
 * Calls verifyDeath() on the Successor contract from the agent wallet.
 * Only succeeds if the grace period has elapsed on-chain.
 */
export async function verifyDeathOnChain(): Promise<KiteReceipt> {
  const config = getKiteConfig();
  const contractAddress = getSuccessorContractAddress();

  if (config.mode !== "live" || !contractAddress || !config.privateKey) {
    return mockReceipt("successor.verifyDeath", { contractAddress });
  }

  const client = createKiteWalletClient();
  const txHash = await client.writeContract({
    address: contractAddress,
    abi: successorAbi,
    functionName: "verifyDeath",
  });

  return liveReceipt(txHash, { kind: "successor.verifyDeath", contractAddress });
}

/**
 * Calls executeAll() on the Successor contract from the agent wallet.
 * Triggers on-chain execution of all queued instructions.
 */
export async function executeAllOnChain(): Promise<KiteReceipt> {
  const config = getKiteConfig();
  const contractAddress = getSuccessorContractAddress();

  if (config.mode !== "live" || !contractAddress || !config.privateKey) {
    return mockReceipt("successor.executeAll", { contractAddress });
  }

  const client = createKiteWalletClient();
  const txHash = await client.writeContract({
    address: contractAddress,
    abi: successorAbi,
    functionName: "executeAll",
  });

  return liveReceipt(txHash, { kind: "successor.executeAll", contractAddress });
}

/**
 * Queues an instruction on the Successor contract from the agent wallet.
 * Called when a new instruction is added to a plan.
 */
export async function addInstructionOnChain(params: {
  target: `0x${string}`;
  data?: `0x${string}`;
  value?: bigint;
  description: string;
}): Promise<KiteReceipt> {
  const config = getKiteConfig();
  const contractAddress = getSuccessorContractAddress();

  if (config.mode !== "live" || !contractAddress || !config.privateKey) {
    return mockReceipt("successor.addInstruction", {
      contractAddress,
      description: params.description,
    });
  }

  const client = createKiteWalletClient();
  const txHash = await client.writeContract({
    address: contractAddress,
    abi: successorAbi,
    functionName: "addInstruction",
    args: [
      params.target,
      params.data ?? "0x",
      params.value ?? 0n,
      params.description,
    ],
  });

  return liveReceipt(txHash, {
    kind: "successor.addInstruction",
    contractAddress,
    description: params.description,
  });
}

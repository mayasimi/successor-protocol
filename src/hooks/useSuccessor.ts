"use client";

/**
 * useSuccessor
 * ─────────────
 * Wagmi-based hooks for reading and writing to the Successor.sol contract.
 *
 * All write hooks return a `write()` function that triggers the wallet
 * transaction, plus `isPending`, `isSuccess`, `error`, and `txHash`.
 *
 * When NEXT_PUBLIC_SUCCESSOR_CONTRACT_ADDRESS is not set the hooks return
 * graceful mock/disabled states so the UI still renders in dev.
 */

import { useCallback, useMemo } from "react";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import { formatEther } from "viem";

import { SUCCESSOR_ABI, ContractState, getSuccessorContractAddress } from "@/lib/contracts";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SuccessorStatus {
  triggered: boolean;
  /** 0=ACTIVE 1=TRIGGERED 2=EXECUTING 3=COMPLETED */
  currentState: number;
  timeRemaining: bigint;
  totalInstructions: bigint;
  /** Human-readable countdown string */
  timeRemainingLabel: string;
  isActive: boolean;
  isTriggered: boolean;
  isExecuting: boolean;
  isCompleted: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCountdown(seconds: bigint): string {
  if (seconds <= 0n) return "Elapsed";
  const s = Number(seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── useSuccessorStatus ───────────────────────────────────────────────────────

/**
 * Reads the current on-chain status of the Successor contract.
 * Polls every 30 seconds.
 */
export function useSuccessorStatus() {
  const address = getSuccessorContractAddress();

  const { data, isLoading, error, refetch } = useReadContract({
    address,
    abi: SUCCESSOR_ABI,
    functionName: "getStatus",
    query: {
      enabled: !!address,
      refetchInterval: 30_000,
    },
  });

  const status = useMemo<SuccessorStatus | null>(() => {
    if (!data) return null;
    const [triggered, currentState, timeRemaining, totalInstructions] = data;
    const state = Number(currentState);
    return {
      triggered,
      currentState: state,
      timeRemaining,
      totalInstructions,
      timeRemainingLabel: formatCountdown(timeRemaining),
      isActive:     state === ContractState.ACTIVE,
      isTriggered:  state === ContractState.TRIGGERED || triggered,
      isExecuting:  state === ContractState.EXECUTING,
      isCompleted:  state === ContractState.COMPLETED,
    };
  }, [data]);

  return { status, isLoading, error, refetch };
}

// ─── useLastPing ──────────────────────────────────────────────────────────────

/** Returns the unix timestamp (bigint) of the last on-chain heartbeat. */
export function useLastPing() {
  const address = getSuccessorContractAddress();

  const { data, isLoading, refetch } = useReadContract({
    address,
    abi: SUCCESSOR_ABI,
    functionName: "lastPing",
    query: {
      enabled: !!address,
      refetchInterval: 30_000,
    },
  });

  const lastPingDate = useMemo(() => {
    if (!data) return null;
    return new Date(Number(data) * 1000);
  }, [data]);

  return { lastPing: data, lastPingDate, isLoading, refetch };
}

// ─── useContractKin ───────────────────────────────────────────────────────────

/** Returns the current on-chain kin address. */
export function useContractKin() {
  const address = getSuccessorContractAddress();

  const { data: kinAddress, isLoading, refetch } = useReadContract({
    address,
    abi: SUCCESSOR_ABI,
    functionName: "kinAddress",
    query: { enabled: !!address },
  });

  return { kinAddress, isLoading, refetch };
}

// ─── useRemainingAllowance ────────────────────────────────────────────────────

/** Returns the remaining daily spend allowance in ZG (formatted). */
export function useRemainingAllowance() {
  const address = getSuccessorContractAddress();

  const { data, isLoading } = useReadContract({
    address,
    abi: SUCCESSOR_ABI,
    functionName: "remainingDailyAllowance",
    query: { enabled: !!address },
  });

  const formatted = useMemo(() => {
    if (!data) return null;
    // type(uint256).max means unlimited
    if (data === BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")) {
      return "Unlimited";
    }
    return `${formatEther(data)} ZG`;
  }, [data]);

  return { allowance: data, formatted, isLoading };
}

// ─── usePing ──────────────────────────────────────────────────────────────────

/**
 * Sends a heartbeat ping to the Successor contract.
 * Only callable by the contract owner.
 */
export function usePing() {
  const address = getSuccessorContractAddress();
  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const ping = useCallback(() => {
    if (!address) return;
    writeContract({
      address,
      abi: SUCCESSOR_ABI,
      functionName: "ping",
    });
  }, [address, writeContract]);

  return {
    ping,
    txHash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    reset,
    isContractConfigured: !!address,
  };
}

// ─── useSetKinAddress ─────────────────────────────────────────────────────────

/** Updates the next-of-kin address on-chain. Only callable by owner. */
export function useSetKinAddress() {
  const address = getSuccessorContractAddress();
  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const setKin = useCallback(
    (newKin: `0x${string}`) => {
      if (!address) return;
      writeContract({
        address,
        abi: SUCCESSOR_ABI,
        functionName: "setKinAddress",
        args: [newKin],
      });
    },
    [address, writeContract]
  );

  return {
    setKin,
    txHash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    reset,
    isContractConfigured: !!address,
  };
}

// ─── useSetGracePeriod ────────────────────────────────────────────────────────

/** Updates the grace period (in seconds) on-chain. Only callable by owner. */
export function useSetGracePeriod() {
  const address = getSuccessorContractAddress();
  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const setGracePeriod = useCallback(
    (days: number) => {
      if (!address) return;
      writeContract({
        address,
        abi: SUCCESSOR_ABI,
        functionName: "setGracePeriod",
        args: [BigInt(days * 24 * 60 * 60)],
      });
    },
    [address, writeContract]
  );

  return {
    setGracePeriod,
    txHash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    reset,
    isContractConfigured: !!address,
  };
}

// ─── useAddInstruction ────────────────────────────────────────────────────────

/** Queues a new instruction on-chain. Only callable by owner. */
export function useAddInstruction() {
  const address = getSuccessorContractAddress();
  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const addInstruction = useCallback(
    (params: {
      target: `0x${string}`;
      data?: `0x${string}`;
      value?: bigint;
      description: string;
    }) => {
      if (!address) return;
      writeContract({
        address,
        abi: SUCCESSOR_ABI,
        functionName: "addInstruction",
        args: [
          params.target,
          params.data ?? "0x",
          params.value ?? 0n,
          params.description,
        ],
      });
    },
    [address, writeContract]
  );

  return {
    addInstruction,
    txHash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    reset,
    isContractConfigured: !!address,
  };
}

// ─── useVerifyDeath ───────────────────────────────────────────────────────────

/** Kin calls this to verify death and transition to EXECUTING state. */
export function useVerifyDeath() {
  const address = getSuccessorContractAddress();
  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const verifyDeath = useCallback(() => {
    if (!address) return;
    writeContract({
      address,
      abi: SUCCESSOR_ABI,
      functionName: "verifyDeath",
    });
  }, [address, writeContract]);

  return {
    verifyDeath,
    txHash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    reset,
    isContractConfigured: !!address,
  };
}

// ─── useExecuteAll ────────────────────────────────────────────────────────────

/** Executes all queued instructions. Callable by anyone in EXECUTING state. */
export function useExecuteAll() {
  const address = getSuccessorContractAddress();
  const { writeContract, data: txHash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const executeAll = useCallback(() => {
    if (!address) return;
    writeContract({
      address,
      abi: SUCCESSOR_ABI,
      functionName: "executeAll",
    });
  }, [address, writeContract]);

  return {
    executeAll,
    txHash,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    reset,
    isContractConfigured: !!address,
  };
}

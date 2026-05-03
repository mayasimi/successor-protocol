/**
 * Successor.sol ABI and address helpers.
 *
 * The ABI is derived directly from the compiled contract.
 * Keep this in sync with contracts/src/Successor.sol.
 */

// ─── ABI ─────────────────────────────────────────────────────────────────────

export const SUCCESSOR_ABI = [
  // ── State variables (public getters) ──────────────────────────────────────
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "kinAddress",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "gracePeriod",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "dailySpendLimit",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "lastPing",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "state",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "instructionCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },

  // ── View helpers ──────────────────────────────────────────────────────────
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
  {
    type: "function",
    name: "remainingDailyAllowance",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "instructions",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [
      { name: "target", type: "address" },
      { name: "data", type: "bytes" },
      { name: "value", type: "uint256" },
      { name: "description", type: "string" },
      { name: "executed", type: "bool" },
      { name: "succeeded", type: "bool" },
    ],
  },

  // ── Heartbeat ─────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "ping",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },

  // ── Configuration ─────────────────────────────────────────────────────────
  {
    type: "function",
    name: "setGracePeriod",
    stateMutability: "nonpayable",
    inputs: [{ name: "newPeriod", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setKinAddress",
    stateMutability: "nonpayable",
    inputs: [{ name: "newKin", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setDailySpendLimit",
    stateMutability: "nonpayable",
    inputs: [{ name: "newLimit", type: "uint256" }],
    outputs: [],
  },

  // ── Instructions ──────────────────────────────────────────────────────────
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
    name: "removeInstruction",
    stateMutability: "nonpayable",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "reorderInstructions",
    stateMutability: "nonpayable",
    inputs: [
      { name: "indexA", type: "uint256" },
      { name: "indexB", type: "uint256" },
    ],
    outputs: [],
  },

  // ── Death verification ────────────────────────────────────────────────────
  {
    type: "function",
    name: "verifyDeath",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },

  // ── Execution ─────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "executeAll",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "executeOne",
    stateMutability: "nonpayable",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [],
  },

  // ── Events ────────────────────────────────────────────────────────────────
  {
    type: "event",
    name: "HeartbeatPing",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "GracePeriodChanged",
    inputs: [
      { name: "oldPeriod", type: "uint256", indexed: false },
      { name: "newPeriod", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "KinAddressChanged",
    inputs: [
      { name: "oldKin", type: "address", indexed: true },
      { name: "newKin", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "DeathVerified",
    inputs: [
      { name: "kin", type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "InstructionAdded",
    inputs: [
      { name: "index", type: "uint256", indexed: true },
      { name: "target", type: "address", indexed: false },
      { name: "data", type: "bytes", indexed: false },
      { name: "value", type: "uint256", indexed: false },
      { name: "description", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "InstructionExecuted",
    inputs: [
      { name: "index", type: "uint256", indexed: true },
      { name: "success", type: "bool", indexed: false },
      { name: "returnData", type: "bytes", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ExecutionCompleted",
    inputs: [{ name: "timestamp", type: "uint256", indexed: false }],
  },
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },

  // ── Errors ────────────────────────────────────────────────────────────────
  { type: "error", name: "NotOwner", inputs: [] },
  { type: "error", name: "NotKin", inputs: [] },
  { type: "error", name: "AlreadyTriggered", inputs: [] },
  { type: "error", name: "GracePeriodNotElapsed", inputs: [] },
  { type: "error", name: "NotInExecutingState", inputs: [] },
  { type: "error", name: "InstructionIndexOutOfBounds", inputs: [] },
  { type: "error", name: "InstructionAlreadyExecuted", inputs: [] },
  {
    type: "error",
    name: "DailySpendLimitExceeded",
    inputs: [
      { name: "requested", type: "uint256" },
      { name: "remaining", type: "uint256" },
    ],
  },
  { type: "error", name: "ZeroAddress", inputs: [] },
  { type: "error", name: "ZeroGracePeriod", inputs: [] },
  {
    type: "error",
    name: "InsufficientContractBalance",
    inputs: [
      { name: "required", type: "uint256" },
      { name: "available", type: "uint256" },
    ],
  },
] as const;

// ─── Contract state enum (mirrors Solidity) ───────────────────────────────────

export const ContractState = {
  ACTIVE: 0,
  TRIGGERED: 1,
  EXECUTING: 2,
  COMPLETED: 3,
} as const;

export type ContractStateValue = (typeof ContractState)[keyof typeof ContractState];

export function contractStateLabel(state: number): string {
  switch (state) {
    case ContractState.ACTIVE:    return "Active";
    case ContractState.TRIGGERED: return "Triggered";
    case ContractState.EXECUTING: return "Executing";
    case ContractState.COMPLETED: return "Completed";
    default:                      return "Unknown";
  }
}

// ─── Address helper ───────────────────────────────────────────────────────────

/**
 * Returns the Successor contract address from the environment.
 * Falls back to undefined when not configured (mock mode).
 */
export function getSuccessorContractAddress(): `0x${string}` | undefined {
  const addr =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_SUCCESSOR_CONTRACT_ADDRESS ?? "")
      : "";

  return addr.match(/^0x[a-fA-F0-9]{40}$/)
    ? (addr as `0x${string}`)
    : undefined;
}

export type IsoDateString = string;
export type WalletAddress = `0x${string}`;

export type PlanStatus =
  | "active"
  | "warning"
  | "triggered"
  | "executing"
  | "completed"
  | "paused";

export type HeartbeatStatus = "active" | "warning" | "triggered";

export type InstructionType =
  | "transfer_usdc"
  | "notify_contact"
  | "cancel_subscription"
  | "archive_file"
  | "publish_message"
  | "custom";

export type InstructionStatus =
  | "queued"
  | "running"
  | "executed"
  | "failed"
  | "skipped";

export interface HeartbeatState {
  intervalDays: number;
  gracePeriodDays: number;
  lastCheckInAt: IsoDateString;
  nextCheckInDueAt: IsoDateString;
  executionEligibleAt: IsoDateString;
  status: HeartbeatStatus;
  onChainTxHash?: string;
}

export interface SpendingPolicy {
  totalBudgetUsdc: number;
  perTransferLimitUsdc: number;
  spentUsdc: number;
  sessionDurationHours: number;
  allowedRecipientWallets: WalletAddress[];
  allowedMerchants: string[];
}

export interface KitePassportSession {
  sessionId: string;
  delegationId: string;
  agentId: string;
  userDid: string;
  maxBudgetUsdc: number;
  perTransactionLimitUsdc: number;
  expiresAt: IsoDateString;
  status: "mock" | "active" | "expired";
  approvalUrl?: string;
  network: "mainnet" | "testnet" | "mock";
}

export interface Beneficiary {
  id: string;
  name: string;
  email: string;
  walletAddress: WalletAddress;
  allocationPercent: number;
  status: "pending" | "confirmed" | "declined";
  confirmationRef: string;
  createdAt: IsoDateString;
  confirmedAt?: IsoDateString;
}

export interface BaseInstruction {
  id: string;
  type: InstructionType;
  title: string;
  priority: number;
  status: InstructionStatus;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  executedAt?: IsoDateString;
  failedAt?: IsoDateString;
  failureReason?: string;
  result?: InstructionResult;
}

export interface TransferUsdcInstruction extends BaseInstruction {
  type: "transfer_usdc";
  amountUsdc: number;
  recipientWallet: WalletAddress;
  recipientName?: string;
  note?: string;
}

export interface NotifyContactInstruction extends BaseInstruction {
  type: "notify_contact";
  contactName: string;
  contactEmail: string;
  subject: string;
  message: string;
}

export interface CancelSubscriptionInstruction extends BaseInstruction {
  type: "cancel_subscription";
  provider: string;
  accountReference: string;
  supportEmail?: string;
  cancelUrl?: string;
}

export interface ArchiveFileInstruction extends BaseInstruction {
  type: "archive_file";
  sourceUri: string;
  archiveLabel?: string;
  description?: string;
}

export interface PublishMessageInstruction extends BaseInstruction {
  type: "publish_message";
  channel: "public" | "email" | "webhook" | "ipfs";
  message: string;
}

export interface CustomInstruction extends BaseInstruction {
  type: "custom";
  action: string;
  payload: Record<string, unknown>;
}

export type EstateInstruction =
  | TransferUsdcInstruction
  | NotifyContactInstruction
  | CancelSubscriptionInstruction
  | ArchiveFileInstruction
  | PublishMessageInstruction
  | CustomInstruction;

export interface InstructionResult {
  provider: "kite" | "webhook" | "mock";
  txHash?: string;
  proof?: string;
  reference?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface EstatePlan {
  id: string;
  ownerName: string;
  ownerEmail?: string;
  ownerWallet: WalletAddress;
  agentId: string;
  status: PlanStatus;
  heartbeat: HeartbeatState;
  spendingPolicy: SpendingPolicy;
  passportSession?: KitePassportSession;
  beneficiaries: Beneficiary[];
  instructions: EstateInstruction[];
  farewellMessage?: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  triggeredAt?: IsoDateString;
  completedAt?: IsoDateString;
}

export type AttestationType =
  | "plan_created"
  | "plan_updated"
  | "passport_session"
  | "beneficiary_added"
  | "beneficiary_confirmed"
  | "instruction_added"
  | "heartbeat_recorded"
  | "heartbeat_missed"
  | "execution_started"
  | "instruction_executed"
  | "instruction_failed"
  | "execution_completed";

export interface AttestationProof {
  algorithm: "sha256";
  payloadHash: `sha256:${string}`;
  canonicalDigest: string;
  signature?: string;
  signedAt: IsoDateString;
}

export interface Attestation {
  id: string;
  planId: string;
  type: AttestationType;
  action: string;
  subjectId?: string;
  payloadHash: `0x${string}`;
  proof: AttestationProof;
  txHash: string;
  chainId: number;
  network: "mainnet" | "testnet" | "mock";
  explorerUrl?: string;
  createdAt: IsoDateString;
  metadata: Record<string, unknown>;
}

export interface AuditEvent {
  id: string;
  planId?: string;
  action: string;
  createdAt: IsoDateString;
  metadata: Record<string, unknown>;
}

export interface BackendState {
  version: 1;
  plans: Record<string, EstatePlan>;
  attestations: Record<string, Attestation>;
  auditLog: AuditEvent[];
}

export interface AgentInstructionReport {
  instructionId: string;
  type: InstructionType;
  status: InstructionStatus;
  message: string;
  txHash?: string;
  attestationId?: string;
}

export interface AgentPlanReport {
  planId: string;
  ownerWallet: WalletAddress;
  status: PlanStatus;
  executable: boolean;
  message: string;
  instructions: AgentInstructionReport[];
}

export interface AgentRunReport {
  ranAt: IsoDateString;
  dryRun: boolean;
  checkedPlans: number;
  triggeredPlans: number;
  reports: AgentPlanReport[];
}

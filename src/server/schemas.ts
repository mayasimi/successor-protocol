import { z } from "zod";

import type { WalletAddress } from "./types";

export const walletAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/)
  .transform((value) => value as WalletAddress);

const emailSchema = z.string().email().max(255);
const nonEmptyString = z.string().trim().min(1);
const moneySchema = z.coerce.number().positive().max(10_000_000);

export const heartbeatInputSchema = z.object({
  intervalDays: z.coerce.number().int().min(1).max(365).default(7),
  gracePeriodDays: z.coerce.number().int().min(0).max(90).default(3),
  lastCheckInAt: z.string().datetime().optional(),
  onChainTxHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
});

export const spendingPolicyInputSchema = z.object({
  totalBudgetUsdc: moneySchema.default(5_000),
  perTransferLimitUsdc: moneySchema.default(2_500),
  sessionDurationHours: z.coerce.number().int().min(1).max(24 * 365).default(24 * 30),
  allowedRecipientWallets: z.array(walletAddressSchema).default([]),
  allowedMerchants: z.array(z.string().min(1).max(120)).default([]),
});

export const beneficiaryInputSchema = z.object({
  name: nonEmptyString.max(100),
  email: emailSchema,
  walletAddress: walletAddressSchema,
  allocationPercent: z.coerce.number().min(0).max(100),
});

const instructionBaseSchema = {
  title: nonEmptyString.max(160),
  priority: z.coerce.number().int().min(0).max(100).default(50),
};

export const instructionInputSchema = z.discriminatedUnion("type", [
  z.object({
    ...instructionBaseSchema,
    type: z.literal("transfer_usdc"),
    amountUsdc: moneySchema,
    recipientWallet: walletAddressSchema,
    recipientName: z.string().trim().max(100).optional(),
    note: z.string().trim().max(500).optional(),
  }),
  z.object({
    ...instructionBaseSchema,
    type: z.literal("notify_contact"),
    contactName: nonEmptyString.max(100),
    contactEmail: emailSchema,
    subject: nonEmptyString.max(160),
    message: nonEmptyString.max(5_000),
  }),
  z.object({
    ...instructionBaseSchema,
    type: z.literal("cancel_subscription"),
    provider: nonEmptyString.max(120),
    accountReference: nonEmptyString.max(200),
    supportEmail: emailSchema.optional(),
    cancelUrl: z.string().url().optional(),
  }),
  z.object({
    ...instructionBaseSchema,
    type: z.literal("archive_file"),
    sourceUri: nonEmptyString.max(500),
    archiveLabel: z.string().trim().max(160).optional(),
    description: z.string().trim().max(1_000).optional(),
  }),
  z.object({
    ...instructionBaseSchema,
    type: z.literal("publish_message"),
    channel: z.enum(["public", "email", "webhook", "ipfs"]).default("public"),
    message: nonEmptyString.max(10_000),
  }),
  z.object({
    ...instructionBaseSchema,
    type: z.literal("custom"),
    action: nonEmptyString.max(160),
    payload: z.record(z.unknown()).default({}),
  }),
]);

export const createPlanSchema = z
  .object({
    ownerName: nonEmptyString.max(100),
    ownerEmail: emailSchema.optional(),
    ownerWallet: walletAddressSchema,
    agentId: z.string().trim().min(1).max(250).optional(),
    heartbeat: heartbeatInputSchema.default({}),
    spendingPolicy: spendingPolicyInputSchema.default({}),
    beneficiaries: z.array(beneficiaryInputSchema).default([]),
    instructions: z.array(instructionInputSchema).default([]),
    farewellMessage: z.string().trim().max(10_000).optional(),
  })
  .superRefine((value, ctx) => {
    const allocated = value.beneficiaries.reduce(
      (sum, beneficiary) => sum + beneficiary.allocationPercent,
      0
    );

    if (allocated > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["beneficiaries"],
        message: "Beneficiary allocations cannot exceed 100%",
      });
    }

    if (
      value.spendingPolicy.perTransferLimitUsdc >
      value.spendingPolicy.totalBudgetUsdc
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["spendingPolicy", "perTransferLimitUsdc"],
        message: "Per-transfer limit cannot exceed the total budget",
      });
    }
  });

export const patchPlanSchema = z.object({
  ownerName: z.string().trim().min(1).max(100).optional(),
  ownerEmail: emailSchema.optional(),
  heartbeat: heartbeatInputSchema.partial().optional(),
  spendingPolicy: spendingPolicyInputSchema.partial().optional(),
  farewellMessage: z.string().trim().max(10_000).optional(),
  status: z.enum(["active", "paused"]).optional(),
});

export const recordHeartbeatSchema = z.object({
  checkedInAt: z.string().datetime().optional(),
  onChainTxHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  walletAddress: walletAddressSchema.optional(),
});

export const confirmKinSchema = z.object({
  ref: z.string().min(12),
  status: z.enum(["confirmed", "declined"]).default("confirmed"),
});

export const agentRunSchema = z.object({
  planId: z.string().optional(),
  dryRun: z.boolean().default(false),
  now: z.string().datetime().optional(),
});

export const kiteSessionSchema = z.object({
  planId: z.string().min(1),
});

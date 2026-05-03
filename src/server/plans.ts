import "server-only";

import { z } from "zod";

import { createAttestation } from "./attestations";
import { makeId, nowIso } from "./crypto";
import { createAuditEvent, readState, updateState } from "./db";
import { ConflictError, NotFoundError, UnauthorizedError } from "./errors";
import {
  createHeartbeatState,
  derivePlanStatus,
  refreshHeartbeatStatus,
} from "./heartbeat";
import { createPassportSession } from "./kite";
import {
  beneficiaryInputSchema,
  createPlanSchema,
  instructionInputSchema,
  patchPlanSchema,
  recordHeartbeatSchema,
} from "./schemas";
import type {
  Beneficiary,
  EstateInstruction,
  EstatePlan,
  SpendingPolicy,
  WalletAddress,
} from "./types";

type CreatePlanInput = z.infer<typeof createPlanSchema>;
type PatchPlanInput = z.infer<typeof patchPlanSchema>;
type InstructionInput = z.infer<typeof instructionInputSchema>;
type BeneficiaryInput = z.infer<typeof beneficiaryInputSchema>;
type RecordHeartbeatInput = z.infer<typeof recordHeartbeatSchema>;

export async function listPlans() {
  const state = await readState();
  return Object.values(state.plans)
    .map(presentPlan)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getPlan(planId: string) {
  const state = await readState();
  const plan = state.plans[planId];

  if (!plan) {
    throw new NotFoundError("Estate plan");
  }

  return presentPlan(plan);
}

export async function createEstatePlan(rawInput: unknown) {
  const input = createPlanSchema.parse(rawInput);
  const now = nowIso();
  const beneficiaries = input.beneficiaries.map((beneficiary) =>
    buildBeneficiary(beneficiary, now)
  );
  const spendingPolicy = buildSpendingPolicy(input, beneficiaries);
  const ownerDid = `did:kite:${input.ownerWallet.toLowerCase()}`;
  const plan: EstatePlan = {
    id: makeId("plan"),
    ownerName: input.ownerName,
    ownerEmail: input.ownerEmail,
    ownerWallet: input.ownerWallet,
    agentId: input.agentId ?? `${ownerDid}/dead-mans-agent-v1`,
    status: "active",
    heartbeat: createHeartbeatState(input.heartbeat),
    spendingPolicy,
    beneficiaries,
    instructions: input.instructions.map((instruction) =>
      buildInstruction(instruction, now)
    ),
    farewellMessage: input.farewellMessage,
    createdAt: now,
    updatedAt: now,
  };

  await updateState((state) => {
    state.plans[plan.id] = plan;
    state.auditLog.push(
      createAuditEvent(
        "plan.created",
        {
          ownerWallet: plan.ownerWallet,
          instructionCount: plan.instructions.length,
          beneficiaryCount: plan.beneficiaries.length,
        },
        plan.id
      )
    );
  });

  await createAttestation({
    planId: plan.id,
    type: "plan_created",
    action: "estate_plan.create",
    subjectId: plan.id,
    payload: {
      plan,
    },
  });

  await openPassportSession(plan.id);

  return getPlan(plan.id);
}

export async function patchEstatePlan(planId: string, rawInput: unknown) {
  const input = patchPlanSchema.parse(rawInput);

  const plan = await updateState((state) => {
    const existing = state.plans[planId];

    if (!existing) {
      throw new NotFoundError("Estate plan");
    }

    if (input.ownerName) {
      existing.ownerName = input.ownerName;
    }

    if (input.ownerEmail) {
      existing.ownerEmail = input.ownerEmail;
    }

    if (input.status) {
      existing.status = input.status;
    }

    if (typeof input.farewellMessage !== "undefined") {
      existing.farewellMessage = input.farewellMessage;
    }

    if (input.heartbeat) {
      existing.heartbeat = createHeartbeatState({
        intervalDays: input.heartbeat.intervalDays ?? existing.heartbeat.intervalDays,
        gracePeriodDays:
          input.heartbeat.gracePeriodDays ?? existing.heartbeat.gracePeriodDays,
        lastCheckInAt:
          input.heartbeat.lastCheckInAt ?? existing.heartbeat.lastCheckInAt,
        onChainTxHash:
          input.heartbeat.onChainTxHash ?? existing.heartbeat.onChainTxHash,
      });
    }

    if (input.spendingPolicy) {
      existing.spendingPolicy = {
        ...existing.spendingPolicy,
        ...input.spendingPolicy,
        spentUsdc: existing.spendingPolicy.spentUsdc,
        allowedRecipientWallets:
          input.spendingPolicy.allowedRecipientWallets ??
          existing.spendingPolicy.allowedRecipientWallets,
        allowedMerchants:
          input.spendingPolicy.allowedMerchants ??
          existing.spendingPolicy.allowedMerchants,
      };
    }

    existing.updatedAt = nowIso();
    state.auditLog.push(
      createAuditEvent("plan.updated", { fields: Object.keys(input) }, planId)
    );

    return structuredClone(existing);
  });

  await createAttestation({
    planId,
    type: "plan_updated",
    action: "estate_plan.update",
    subjectId: planId,
    payload: {
      patch: input,
      plan,
    },
  });

  return getPlan(planId);
}

export async function addInstructionToPlan(planId: string, rawInput: unknown) {
  const input = instructionInputSchema.parse(rawInput);
  const instruction = buildInstruction(input, nowIso());

  await updateState((state) => {
    const plan = state.plans[planId];

    if (!plan) {
      throw new NotFoundError("Estate plan");
    }

    ensurePlanCanChange(plan);
    plan.instructions.push(instruction);
    plan.updatedAt = nowIso();
    state.auditLog.push(
      createAuditEvent(
        "instruction.added",
        { instructionId: instruction.id, type: instruction.type },
        planId
      )
    );
  });

  await createAttestation({
    planId,
    type: "instruction_added",
    action: "instruction.queue",
    subjectId: instruction.id,
    payload: {
      instruction,
    },
  });

  return instruction;
}

export async function addBeneficiaryToPlan(planId: string, rawInput: unknown) {
  const input = beneficiaryInputSchema.parse(rawInput);
  const beneficiary = buildBeneficiary(input, nowIso());

  await updateState((state) => {
    const plan = state.plans[planId];

    if (!plan) {
      throw new NotFoundError("Estate plan");
    }

    ensurePlanCanChange(plan);
    const allocated = plan.beneficiaries.reduce(
      (sum, item) => sum + item.allocationPercent,
      0
    );

    if (allocated + beneficiary.allocationPercent > 100) {
      throw new ConflictError("Beneficiary allocations cannot exceed 100%");
    }

    plan.beneficiaries.push(beneficiary);
    plan.spendingPolicy.allowedRecipientWallets = uniqueWallets([
      ...plan.spendingPolicy.allowedRecipientWallets,
      beneficiary.walletAddress,
    ]);
    plan.updatedAt = nowIso();
    state.auditLog.push(
      createAuditEvent(
        "beneficiary.added",
        { beneficiaryId: beneficiary.id },
        planId
      )
    );
  });

  await createAttestation({
    planId,
    type: "beneficiary_added",
    action: "beneficiary.invite",
    subjectId: beneficiary.id,
    payload: {
      beneficiary,
    },
  });

  return beneficiary;
}

export async function recordHeartbeat(planId: string, rawInput: unknown) {
  const input = recordHeartbeatSchema.parse(rawInput);
  const checkedInAt = input.checkedInAt ?? nowIso();

  const plan = await updateState((state) => {
    const existing = state.plans[planId];

    if (!existing) {
      throw new NotFoundError("Estate plan");
    }

    if (existing.status === "completed" || existing.status === "executing") {
      throw new ConflictError("Cannot record heartbeat after execution has begun");
    }

    if (
      input.walletAddress &&
      input.walletAddress.toLowerCase() !== existing.ownerWallet.toLowerCase()
    ) {
      throw new UnauthorizedError("Heartbeat wallet does not match plan owner");
    }

    existing.heartbeat = createHeartbeatState({
      intervalDays: existing.heartbeat.intervalDays,
      gracePeriodDays: existing.heartbeat.gracePeriodDays,
      lastCheckInAt: checkedInAt,
      onChainTxHash: input.onChainTxHash,
    });
    existing.status = "active";
    existing.updatedAt = nowIso();
    existing.triggeredAt = undefined;

    state.auditLog.push(
      createAuditEvent(
        "heartbeat.recorded",
        { checkedInAt, onChainTxHash: input.onChainTxHash },
        planId
      )
    );

    return structuredClone(existing);
  });

  const attestation = await createAttestation({
    planId,
    type: "heartbeat_recorded",
    action: "heartbeat.record",
    subjectId: plan.heartbeat.onChainTxHash,
    payload: {
      checkedInAt,
      ownerWallet: plan.ownerWallet,
      onChainTxHash: input.onChainTxHash,
      nextCheckInDueAt: plan.heartbeat.nextCheckInDueAt,
      executionEligibleAt: plan.heartbeat.executionEligibleAt,
    },
  });

  return {
    plan: presentPlan(plan),
    attestation,
  };
}

export async function confirmNextOfKin(rawInput: unknown) {
  const { confirmKinSchema } = await import("./schemas");
  const input = confirmKinSchema.parse(rawInput);

  const result = await updateState((state) => {
    for (const plan of Object.values(state.plans)) {
      const beneficiary = plan.beneficiaries.find(
        (item) => item.confirmationRef === input.ref
      );

      if (!beneficiary) {
        continue;
      }

      beneficiary.status = input.status;
      beneficiary.confirmedAt = input.status === "confirmed" ? nowIso() : undefined;
      plan.updatedAt = nowIso();
      state.auditLog.push(
        createAuditEvent(
          "beneficiary.confirmed",
          { beneficiaryId: beneficiary.id, status: input.status },
          plan.id
        )
      );

      return {
        plan: structuredClone(plan),
        beneficiary: structuredClone(beneficiary),
      };
    }

    throw new NotFoundError("Confirmation reference");
  });

  await createAttestation({
    planId: result.plan.id,
    type: "beneficiary_confirmed",
    action: "beneficiary.confirm",
    subjectId: result.beneficiary.id,
    payload: {
      beneficiaryId: result.beneficiary.id,
      status: result.beneficiary.status,
      confirmedAt: result.beneficiary.confirmedAt,
    },
  });

  return result;
}

export async function openPassportSession(planId: string) {
  const plan = await getPlan(planId);
  const session = await createPassportSession(plan);

  await updateState((state) => {
    const existing = state.plans[planId];

    if (!existing) {
      throw new NotFoundError("Estate plan");
    }

    existing.passportSession = session;
    existing.updatedAt = nowIso();
    state.auditLog.push(
      createAuditEvent(
        "kite.passport_session.created",
        {
          sessionId: session.sessionId,
          delegationId: session.delegationId,
          maxBudgetUsdc: session.maxBudgetUsdc,
        },
        planId
      )
    );
  });

  await createAttestation({
    planId,
    type: "passport_session",
    action: "kite.passport_session",
    subjectId: session.sessionId,
    payload: {
      session,
    },
  });

  return session;
}

export function presentPlan(plan: EstatePlan): EstatePlan {
  const heartbeat = refreshHeartbeatStatus(plan.heartbeat);

  return {
    ...plan,
    heartbeat,
    status: derivePlanStatus(plan.status, heartbeat),
  };
}

function buildSpendingPolicy(
  input: CreatePlanInput,
  beneficiaries: Beneficiary[]
): SpendingPolicy {
  return {
    totalBudgetUsdc: input.spendingPolicy.totalBudgetUsdc,
    perTransferLimitUsdc: input.spendingPolicy.perTransferLimitUsdc,
    spentUsdc: 0,
    sessionDurationHours: input.spendingPolicy.sessionDurationHours,
    allowedRecipientWallets: uniqueWallets([
      ...input.spendingPolicy.allowedRecipientWallets,
      ...beneficiaries.map((beneficiary) => beneficiary.walletAddress),
    ]),
    allowedMerchants: input.spendingPolicy.allowedMerchants,
  };
}

function buildBeneficiary(input: BeneficiaryInput, now: string): Beneficiary {
  return {
    id: makeId("kin"),
    name: input.name,
    email: input.email,
    walletAddress: input.walletAddress,
    allocationPercent: input.allocationPercent,
    status: "pending",
    confirmationRef: makeId("confirm"),
    createdAt: now,
  };
}

function buildInstruction(
  input: InstructionInput,
  now: string
): EstateInstruction {
  const common = {
    id: makeId("inst"),
    title: input.title,
    priority: input.priority,
    status: "queued" as const,
    createdAt: now,
    updatedAt: now,
  };

  switch (input.type) {
    case "transfer_usdc":
      return {
        ...common,
        type: input.type,
        amountUsdc: input.amountUsdc,
        recipientWallet: input.recipientWallet,
        recipientName: input.recipientName,
        note: input.note,
      };
    case "notify_contact":
      return {
        ...common,
        type: input.type,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        subject: input.subject,
        message: input.message,
      };
    case "cancel_subscription":
      return {
        ...common,
        type: input.type,
        provider: input.provider,
        accountReference: input.accountReference,
        supportEmail: input.supportEmail,
        cancelUrl: input.cancelUrl,
      };
    case "archive_file":
      return {
        ...common,
        type: input.type,
        sourceUri: input.sourceUri,
        archiveLabel: input.archiveLabel,
        description: input.description,
      };
    case "publish_message":
      return {
        ...common,
        type: input.type,
        channel: input.channel,
        message: input.message,
      };
    case "custom":
      return {
        ...common,
        type: input.type,
        action: input.action,
        payload: input.payload,
      };
  }
}

function ensurePlanCanChange(plan: EstatePlan) {
  if (plan.status === "executing" || plan.status === "completed") {
    throw new ConflictError("Plan can no longer be changed after execution begins");
  }
}

function uniqueWallets(wallets: WalletAddress[]) {
  const seen = new Set<string>();
  return wallets.filter((wallet) => {
    const key = wallet.toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

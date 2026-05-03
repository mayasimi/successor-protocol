import "server-only";

import { z } from "zod";

import { executeServiceAction } from "./actions";
import { createAttestation } from "./attestations";
import { nowIso } from "./crypto";
import { createAuditEvent, readState, updateState } from "./db";
import { ConflictError, NotFoundError } from "./errors";
import {
  derivePlanStatus,
  isExecutionEligible,
  refreshHeartbeatStatus,
} from "./heartbeat";
import { transferUsdc, verifyDeathOnChain, executeAllOnChain } from "./kite";
import { agentRunSchema } from "./schemas";
import type {
  AgentInstructionReport,
  AgentPlanReport,
  AgentRunReport,
  EstateInstruction,
  EstatePlan,
  InstructionResult,
  TransferUsdcInstruction,
} from "./types";

type AgentRunInput = z.infer<typeof agentRunSchema>;

const terminalStatuses = new Set(["executed", "failed", "skipped"]);

export async function getAgentStatus(now = nowIso()) {
  const state = await readState();
  const plans = Object.values(state.plans).map((plan) => {
    const heartbeat = refreshHeartbeatStatus(plan.heartbeat, now);
    const status = derivePlanStatus(plan.status, heartbeat);

    return {
      planId: plan.id,
      ownerWallet: plan.ownerWallet,
      status,
      heartbeat,
      queuedInstructions: plan.instructions.filter(
        (instruction) => instruction.status === "queued"
      ).length,
      executable:
        status !== "paused" &&
        status !== "completed" &&
        isExecutionEligible(heartbeat, now),
    };
  });

  return {
    now,
    duePlans: plans.filter((plan) => plan.executable).length,
    plans,
  };
}

export async function runSuccessorAgent(
  rawInput: unknown = {}
): Promise<AgentRunReport> {
  const input = agentRunSchema.parse(rawInput);
  const ranAt = input.now ?? nowIso();
  const state = await readState();
  const candidates = Object.values(state.plans).filter(
    (plan) => !input.planId || plan.id === input.planId
  );

  if (input.planId && candidates.length === 0) {
    throw new NotFoundError("Estate plan");
  }

  const reports: AgentPlanReport[] = [];

  for (const plan of candidates) {
    reports.push(await runPlan(plan.id, input, ranAt));
  }

  return {
    ranAt,
    dryRun: input.dryRun,
    checkedPlans: candidates.length,
    triggeredPlans: reports.filter((report) => report.executable).length,
    reports,
  };
}

async function runPlan(
  planId: string,
  input: AgentRunInput,
  now: string
): Promise<AgentPlanReport> {
  const state = await readState();
  const plan = state.plans[planId];

  if (!plan) {
    throw new NotFoundError("Estate plan");
  }

  const heartbeat = refreshHeartbeatStatus(plan.heartbeat, now);
  const status = derivePlanStatus(plan.status, heartbeat);
  const executable =
    status !== "paused" &&
    status !== "completed" &&
    status !== "executing" &&
    isExecutionEligible(heartbeat, now);
  const queuedInstructions = plan.instructions
    .filter((instruction) => instruction.status === "queued")
    .sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt));

  if (!executable) {
    return {
      planId,
      ownerWallet: plan.ownerWallet,
      status,
      executable: false,
      message: "Plan is not eligible for execution",
      instructions: [],
    };
  }

  if (input.dryRun) {
    return {
      planId,
      ownerWallet: plan.ownerWallet,
      status,
      executable: true,
      message: `${queuedInstructions.length} instruction(s) would run`,
      instructions: queuedInstructions.map((instruction) => ({
        instructionId: instruction.id,
        type: instruction.type,
        status: instruction.status,
        message: "Dry run only",
      })),
    };
  }

  await updateState((nextState) => {
    const existing = nextState.plans[planId];

    if (!existing) {
      throw new NotFoundError("Estate plan");
    }

    existing.heartbeat = heartbeat;
    existing.status = "executing";
    existing.triggeredAt = existing.triggeredAt ?? now;
    existing.updatedAt = nowIso();
    nextState.auditLog.push(
      createAuditEvent("agent.execution_started", { now }, planId)
    );
  });

  await createAttestation({
    planId,
    type: "heartbeat_missed",
    action: "heartbeat.missed",
    subjectId: plan.heartbeat.onChainTxHash,
    payload: {
      lastCheckInAt: plan.heartbeat.lastCheckInAt,
      executionEligibleAt: plan.heartbeat.executionEligibleAt,
      observedAt: now,
    },
  });

  // Call verifyDeath() on the Successor contract (no-op in mock mode).
  const verifyReceipt = await verifyDeathOnChain();

  await createAttestation({
    planId,
    type: "execution_started",
    action: "agent.execute.start",
    subjectId: plan.agentId,
    payload: {
      agentId: plan.agentId,
      passportSession: plan.passportSession,
      queuedInstructions: queuedInstructions.map((instruction) => instruction.id),
      onChainVerifyTxHash: verifyReceipt.txHash,
    },
  });

  const instructionReports: AgentInstructionReport[] = [];

  for (const instruction of queuedInstructions) {
    instructionReports.push(await executeInstruction(planId, instruction.id));
  }

  const freshState = await readState();
  const freshPlan = freshState.plans[planId];

  if (
    freshPlan &&
    freshPlan.instructions.every((instruction) =>
      terminalStatuses.has(instruction.status)
    )
  ) {
    await updateState((nextState) => {
      const existing = nextState.plans[planId];

      if (!existing) {
        throw new NotFoundError("Estate plan");
      }

      existing.status = "completed";
      existing.completedAt = nowIso();
      existing.updatedAt = nowIso();
      nextState.auditLog.push(
        createAuditEvent(
          "agent.execution_completed",
          { instructionCount: existing.instructions.length },
          planId
        )
      );
    });

    await createAttestation({
      planId,
      type: "execution_completed",
      action: "agent.execute.complete",
      subjectId: plan.agentId,
      payload: {
        instructionReports,
      },
    });

    // Trigger on-chain executeAll() to mirror the off-chain execution result.
    const execReceipt = await executeAllOnChain();
    await createAttestation({
      planId,
      type: "execution_completed",
      action: "agent.execute.onchain",
      subjectId: execReceipt.txHash,
      payload: {
        txHash: execReceipt.txHash,
        provider: execReceipt.provider,
      },
    });
  }

  return {
    planId,
    ownerWallet: plan.ownerWallet,
    status: "executing",
    executable: true,
    message: `Executed ${instructionReports.length} instruction(s)`,
    instructions: instructionReports,
  };
}

async function executeInstruction(
  planId: string,
  instructionId: string
): Promise<AgentInstructionReport> {
  const context = await updateState((state) => {
    const plan = state.plans[planId];

    if (!plan) {
      throw new NotFoundError("Estate plan");
    }

    const instruction = plan.instructions.find((item) => item.id === instructionId);

    if (!instruction) {
      throw new NotFoundError("Instruction");
    }

    if (instruction.status !== "queued") {
      throw new ConflictError("Instruction is not queued");
    }

    instruction.status = "running";
    instruction.updatedAt = nowIso();
    state.auditLog.push(
      createAuditEvent(
        "instruction.running",
        { instructionId, type: instruction.type },
        planId
      )
    );

    return {
      plan: structuredClone(plan),
      instruction: structuredClone(instruction),
    };
  });

  try {
    assertInstructionAllowed(context.plan, context.instruction);
    const result = await dispatchInstruction(context.plan, context.instruction);

    await updateState((state) => {
      const plan = state.plans[planId];

      if (!plan) {
        throw new NotFoundError("Estate plan");
      }

      const instruction = plan.instructions.find((item) => item.id === instructionId);

      if (!instruction) {
        throw new NotFoundError("Instruction");
      }

      instruction.status = "executed";
      instruction.result = result;
      instruction.executedAt = nowIso();
      instruction.updatedAt = nowIso();

      if (instruction.type === "transfer_usdc") {
        plan.spendingPolicy.spentUsdc += instruction.amountUsdc;
      }

      plan.updatedAt = nowIso();
      state.auditLog.push(
        createAuditEvent(
          "instruction.executed",
          { instructionId, type: instruction.type, txHash: result.txHash },
          planId
        )
      );
    });

    const attestation = await createAttestation({
      planId,
      type: "instruction_executed",
      action: `instruction.${context.instruction.type}.executed`,
      subjectId: instructionId,
      payload: {
        instruction: context.instruction,
        result,
      },
    });

    return {
      instructionId,
      type: context.instruction.type,
      status: "executed",
      message: result.message,
      txHash: result.txHash,
      attestationId: attestation.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Instruction failed";

    await updateState((state) => {
      const plan = state.plans[planId];

      if (!plan) {
        throw new NotFoundError("Estate plan");
      }

      const instruction = plan.instructions.find((item) => item.id === instructionId);

      if (!instruction) {
        throw new NotFoundError("Instruction");
      }

      instruction.status = "failed";
      instruction.failureReason = message;
      instruction.failedAt = nowIso();
      instruction.updatedAt = nowIso();
      plan.updatedAt = nowIso();
      state.auditLog.push(
        createAuditEvent(
          "instruction.failed",
          { instructionId, type: instruction.type, message },
          planId
        )
      );
    });

    const attestation = await createAttestation({
      planId,
      type: "instruction_failed",
      action: `instruction.${context.instruction.type}.failed`,
      subjectId: instructionId,
      payload: {
        instruction: context.instruction,
        error: message,
      },
    });

    return {
      instructionId,
      type: context.instruction.type,
      status: "failed",
      message,
      attestationId: attestation.id,
    };
  }
}

function assertInstructionAllowed(
  plan: EstatePlan,
  instruction: EstateInstruction
) {
  if (instruction.type !== "transfer_usdc") {
    return;
  }

  const policy = plan.spendingPolicy;
  const recipient = instruction.recipientWallet.toLowerCase();
  const allowedRecipients = policy.allowedRecipientWallets.map((wallet) =>
    wallet.toLowerCase()
  );

  if (instruction.amountUsdc > policy.perTransferLimitUsdc) {
    throw new Error("Instruction exceeds the Kite per-transfer spending limit");
  }

  if (policy.spentUsdc + instruction.amountUsdc > policy.totalBudgetUsdc) {
    throw new Error("Instruction exceeds the Kite session budget");
  }

  if (allowedRecipients.length > 0 && !allowedRecipients.includes(recipient)) {
    throw new Error("Recipient wallet is outside the approved successor list");
  }
}

async function dispatchInstruction(
  plan: EstatePlan,
  instruction: EstateInstruction
): Promise<InstructionResult> {
  if (instruction.type === "transfer_usdc") {
    return transferUsdc(plan, instruction as TransferUsdcInstruction);
  }

  return executeServiceAction(
    plan,
    instruction as Exclude<EstateInstruction, { type: "transfer_usdc" }>
  );
}

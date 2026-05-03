import "server-only";

import { sha256Hex } from "./crypto";
import type { EstateInstruction, EstatePlan, InstructionResult } from "./types";

export async function executeServiceAction(
  plan: EstatePlan,
  instruction: Exclude<EstateInstruction, { type: "transfer_usdc" }>
): Promise<InstructionResult> {
  const webhookUrl = process.env.SUCCESSOR_ACTION_WEBHOOK_URL;
  const payload = {
    planId: plan.id,
    ownerWallet: plan.ownerWallet,
    agentId: plan.agentId,
    instruction,
  };

  if (webhookUrl) {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Action webhook failed with ${response.status} ${response.statusText}`
      );
    }

    return {
      provider: "webhook",
      reference: response.headers.get("x-successor-reference") ?? undefined,
      message: `${instruction.type} delivered to action webhook`,
      metadata: {
        status: response.status,
      },
    };
  }

  return {
    provider: "mock",
    reference: `mock://${instruction.type}/${instruction.id}`,
    proof: `sha256:${sha256Hex(payload)}`,
    message: `Mock ${instruction.type} action completed`,
    metadata: {
      simulated: true,
    },
  };
}

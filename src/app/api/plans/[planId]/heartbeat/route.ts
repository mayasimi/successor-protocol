import { handleApiError, ok } from "@/server/api";
import { getPlan, recordHeartbeat } from "@/server/plans";
import { pingSuccessorContract } from "@/server/kite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    planId: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const plan = await getPlan(params.planId);
    return ok(plan.heartbeat);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = await request.json().catch(() => ({}));

    // If the request includes an on-chain tx hash the frontend already called
    // ping() directly. Otherwise, the backend agent calls the contract itself.
    const onChainTxHash: string | undefined = body.onChainTxHash;

    let contractTxHash = onChainTxHash;
    if (!contractTxHash) {
      // Backend-initiated ping (e.g. from a cron job or server-side call).
      const receipt = await pingSuccessorContract();
      contractTxHash = receipt.txHash;
    }

    const result = await recordHeartbeat(params.planId, {
      ...body,
      onChainTxHash: contractTxHash,
    });

    return ok(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

import { handleApiError, ok } from "@/server/api";
import { addInstructionToPlan, getPlan } from "@/server/plans";

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
    return ok(plan.instructions);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = await request.json().catch(() => ({}));
    return ok(await addInstructionToPlan(params.planId, body), 201);
  } catch (error) {
    return handleApiError(error);
  }
}

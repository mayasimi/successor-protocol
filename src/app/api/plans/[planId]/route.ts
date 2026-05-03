import { handleApiError, ok } from "@/server/api";
import { getPlan, patchEstatePlan } from "@/server/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    planId: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    return ok(await getPlan(params.planId));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const body = await request.json().catch(() => ({}));
    return ok(await patchEstatePlan(params.planId, body));
  } catch (error) {
    return handleApiError(error);
  }
}

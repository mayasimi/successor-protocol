import { handleApiError, ok } from "@/server/api";
import { createEstatePlan, listPlans } from "@/server/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(await listPlans());
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const plan = await createEstatePlan(body);
    return ok(plan, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

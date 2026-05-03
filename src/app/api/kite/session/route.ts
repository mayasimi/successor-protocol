import { handleApiError, ok, parseBody } from "@/server/api";
import { openPassportSession } from "@/server/plans";
import { kiteSessionSchema } from "@/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { planId } = await parseBody(request, kiteSessionSchema);
    return ok(await openPassportSession(planId), 201);
  } catch (error) {
    return handleApiError(error);
  }
}

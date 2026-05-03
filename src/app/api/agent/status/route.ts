import { handleApiError, ok } from "@/server/api";
import { getAgentStatus } from "@/server/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const now = new URL(request.url).searchParams.get("now") ?? undefined;
    return ok(await getAgentStatus(now));
  } catch (error) {
    return handleApiError(error);
  }
}

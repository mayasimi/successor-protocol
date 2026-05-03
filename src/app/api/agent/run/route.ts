import { handleApiError, ok } from "@/server/api";
import { runSuccessorAgent } from "@/server/agent";
import { UnauthorizedError } from "@/server/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertAgentSecret(request);
    const body = await request.json().catch(() => ({}));
    return ok(await runSuccessorAgent(body));
  } catch (error) {
    return handleApiError(error);
  }
}

function assertAgentSecret(request: Request) {
  const expected = process.env.SUCCESSOR_AGENT_SECRET;

  if (!expected) {
    return;
  }

  const supplied =
    request.headers.get("x-successor-agent-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (supplied !== expected) {
    throw new UnauthorizedError("Invalid successor agent secret");
  }
}

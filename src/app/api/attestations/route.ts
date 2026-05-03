import { handleApiError, ok } from "@/server/api";
import { listAttestations } from "@/server/attestations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return ok(
      await listAttestations(
        url.searchParams.get("planId") ?? undefined,
        url.searchParams.get("type") ?? undefined
      )
    );
  } catch (error) {
    return handleApiError(error);
  }
}

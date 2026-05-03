import { handleApiError, ok } from "@/server/api";
import { readState } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { confirmNextOfKin } from "@/server/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const ref = new URL(request.url).searchParams.get("ref");

    if (!ref) {
      throw new NotFoundError("Confirmation reference");
    }

    const state = await readState();

    for (const plan of Object.values(state.plans)) {
      const beneficiary = plan.beneficiaries.find(
        (item) => item.confirmationRef === ref
      );

      if (beneficiary) {
        return ok({
          planId: plan.id,
          ownerName: plan.ownerName,
          beneficiary,
        });
      }
    }

    throw new NotFoundError("Confirmation reference");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    return ok(await confirmNextOfKin(body));
  } catch (error) {
    return handleApiError(error);
  }
}

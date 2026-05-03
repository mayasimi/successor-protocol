import { getKiteConfig } from "@/server/config";
import { readState } from "@/server/db";
import { handleApiError, ok } from "@/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await readState();
    const kite = getKiteConfig();

    return ok({
      service: "successor-protocol-backend",
      status: "ok",
      plans: Object.keys(state.plans).length,
      attestations: Object.keys(state.attestations).length,
      kite: {
        mode: kite.mode,
        network: kite.network,
        chainId: kite.chainId,
        rpcUrl: kite.rpcUrl,
        passportMcpUrl: kite.passportMcpUrl,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

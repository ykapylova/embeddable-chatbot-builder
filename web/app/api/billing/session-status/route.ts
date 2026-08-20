import { NextResponse } from "next/server";

import { requireAccount, unwrapAccount } from "server/auth/require-account";
import { jsonErr, jsonOk } from "server/http/json-api";
import {
  getCheckoutSessionStatus,
  SessionOwnerMismatchError,
} from "server/services/billing/session-status.service";

export const runtime = "nodejs";

/** Stripe returns to `return_url` even on a failed payment — this is the only source of truth. PROJECT_SPEC.md §10.6. */
export async function GET(request: Request): Promise<NextResponse> {
  const result = await requireAccount();
  if (unwrapAccount(result)) return result;

  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId || !sessionId.startsWith("cs_")) {
    return jsonErr("Invalid sessionId", 400);
  }

  try {
    const outcome = await getCheckoutSessionStatus(sessionId, result.account.clerkUserId);
    return jsonOk({ outcome });
  } catch (error) {
    if (error instanceof SessionOwnerMismatchError) {
      return jsonErr(error.message, 403);
    }
    console.error("[GET /api/billing/session-status]", error);
    return jsonErr("Could not verify the checkout session", 500);
  }
}

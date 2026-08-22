import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireAccount, unwrapAccount } from "server/auth/require-account";
import { jsonErr, jsonOk } from "server/http/json-api";
import { BillingNotConfiguredError } from "server/services/billing/stripe-client";
import { createPortalSession, NoBillingHistoryError } from "server/services/billing/portal.service";

export const runtime = "nodejs";

/** Upgrade, downgrade, cancel, card changes — everything past first purchase happens in the Portal. */
export async function POST(request: Request): Promise<NextResponse> {
  const result = await requireAccount();
  if (unwrapAccount(result)) return result;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr("Invalid JSON body", 400);
  }

  try {
    const url = await createPortalSession(result.account, body);
    return jsonOk({ url });
  } catch (error) {
    // A deployment without Stripe keys is unfinished setup, not a broken app —
    // 503 with the reason beats a 500 the reader cannot act on.
    if (error instanceof BillingNotConfiguredError) {
      return jsonErr(error.message, 503);
    }
    if (error instanceof ZodError) {
      return jsonErr(error.issues[0]?.message ?? "Invalid payload", 422);
    }
    if (error instanceof NoBillingHistoryError) {
      return jsonErr(error.message, 400);
    }
    console.error("[POST /api/billing/portal]", error);
    return jsonErr("Could not open the billing portal", 500);
  }
}

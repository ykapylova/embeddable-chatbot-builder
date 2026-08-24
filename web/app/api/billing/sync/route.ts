import { NextResponse } from "next/server";

import { requireAccount, unwrapAccount } from "server/auth/require-account";
import { jsonAck, jsonErr } from "server/http/json-api";
import { BillingNotConfiguredError } from "server/services/billing/stripe-client";
import { syncSubscriptionFromStripe } from "server/services/billing/sync.service";

export const runtime = "nodejs";

/**
 * Called when the visitor lands back from the Billing Portal. Takes no body:
 * what changed is Stripe's to report, and the account is the session's.
 */
export async function POST(): Promise<NextResponse> {
  const result = await requireAccount();
  if (unwrapAccount(result)) return result;

  try {
    await syncSubscriptionFromStripe(result.account);
    return jsonAck();
  } catch (error) {
    if (error instanceof BillingNotConfiguredError) {
      return jsonErr(error.message, 503);
    }
    console.error("[POST /api/billing/sync]", error);
    return jsonErr("Could not refresh your subscription", 500);
  }
}

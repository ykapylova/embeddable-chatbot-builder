import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireAccount, unwrapAccount } from "server/auth/require-account";
import { jsonErr, jsonOk } from "server/http/json-api";
import { createCheckoutSession, ExistingSubscriberError } from "server/services/billing/checkout.service";

export const runtime = "nodejs";

/** First purchase only (Free → Pro/Business) — everything else is the Billing Portal. PROJECT_SPEC.md §10.6. */
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
    const url = await createCheckoutSession(result.account, body);
    return jsonOk({ url });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonErr(error.issues[0]?.message ?? "Invalid payload", 422);
    }
    if (error instanceof ExistingSubscriberError) {
      return jsonErr(error.message, 409);
    }
    console.error("[POST /api/billing/checkout]", error);
    return jsonErr("Could not start checkout", 500);
  }
}

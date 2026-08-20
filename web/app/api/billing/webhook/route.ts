import { NextResponse } from "next/server";

import { jsonErr } from "server/http/json-api";
import { constructWebhookEvent, handleWebhookEvent } from "server/services/billing/webhook.service";

export const runtime = "nodejs";

/**
 * The only sync channel once plan changes moved into the Billing Portal —
 * PROJECT_SPEC.md §10.7. A failing handler returns 500 so Stripe retries;
 * it must never be swallowed into a 200.
 */
export async function POST(request: Request): Promise<NextResponse> {
  // The App Router will not hand back the raw body a second time, and
  // signature verification needs it byte-for-byte — read it before anything else.
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return jsonErr("Missing stripe-signature header", 400);
  }

  let event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (error) {
    console.error("[POST /api/billing/webhook] signature verification failed", error);
    return jsonErr("Invalid signature", 400);
  }

  try {
    await handleWebhookEvent(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`[POST /api/billing/webhook] failed to handle ${event.type}`, error);
    return jsonErr("Webhook handler failed", 500);
  }
}

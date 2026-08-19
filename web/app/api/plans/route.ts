import { NextResponse } from "next/server";

import { PLAN_CATALOGUE } from "lib/plans";
import { jsonOk } from "server/http/json-api";

export const runtime = "nodejs";

/**
 * Public plan catalogue. The landing page, the pricing page and the billing
 * screen all read this one endpoint, so prices can never drift between them.
 * Stripe price ids are not part of the response — the client asks to subscribe
 * to a plan and an interval, and the server resolves the price itself.
 */
export async function GET(): Promise<NextResponse> {
  return jsonOk(PLAN_CATALOGUE);
}

import { NextResponse } from "next/server";

import { env } from "server/env";
import { jsonErr, jsonOk } from "server/http/json-api";
import { sweepExpiredGrace } from "server/services/billing/grace.service";

export const runtime = "nodejs";

/**
 * Drops accounts whose payment-failed grace window has elapsed to Free —
 * PROJECT_SPEC.md §10.8 #10. Scheduled daily via `vercel.json`, which sends
 * `CRON_SECRET` as a Bearer token automatically once the env var is set.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const secret = env.cronSecret;
  if (!secret) {
    return jsonErr("CRON_SECRET is not configured", 500);
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return jsonErr("Unauthorized", 401);
  }

  const swept = await sweepExpiredGrace();
  return jsonOk({ swept });
}

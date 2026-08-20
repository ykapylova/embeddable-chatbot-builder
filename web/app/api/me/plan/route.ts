import type { NextResponse } from "next/server";

import { requireAccount, unwrapAccount } from "server/auth/require-account";
import { jsonOk } from "server/http/json-api";
import { getPlanUsage } from "server/services/plan.service";

export const runtime = "nodejs";

/**
 * The one place `usePlan()` reads from. Until this resolves the client must
 * show skeletons, not "Free" — a paying account must never see a blocked
 * interface flash on sign-in (PROJECT_SPEC.md §10.5).
 */
export async function GET(): Promise<NextResponse> {
  const result = await requireAccount();
  if (unwrapAccount(result)) return result;

  const usage = await getPlanUsage(result.account.id, result.account.plan);
  return jsonOk(usage);
}

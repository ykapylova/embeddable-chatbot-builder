import { NextResponse } from "next/server";

import { requireAccount, unwrapAccount } from "server/auth/require-account";
import { jsonErr, jsonOk } from "server/http/json-api";
import { SourceBusyError, sourceService } from "server/services/sources/source.service";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ botId: string; sourceId: string }> };

/** Re-runs the full pipeline for an existing source: re-reads its stored
 * content (or re-fetches its URL), then replaces its chunks atomically. */
export async function POST(_request: Request, context: RouteContext): Promise<NextResponse> {
  const result = await requireAccount();
  if (unwrapAccount(result)) return result;

  const { botId, sourceId } = await context.params;

  let source;
  try {
    source = await sourceService.reindex(botId, result.account.id, result.account.plan, sourceId);
  } catch (error) {
    // A second Retry while the first is still running is the user being
    // impatient, not an error in their input — say so rather than starting a
    // duplicate run.
    if (error instanceof SourceBusyError) return jsonErr(error.message, 409);
    throw error;
  }
  if (!source) return jsonErr("Source not found", 404);

  return jsonOk(source);
}

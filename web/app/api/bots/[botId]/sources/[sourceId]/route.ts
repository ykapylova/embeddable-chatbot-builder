import { NextResponse } from "next/server";

import { requireAccount, unwrapAccount } from "server/auth/require-account";
import { jsonAck, jsonErr } from "server/http/json-api";
import { sourceService } from "server/services/sources/source.service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ botId: string; sourceId: string }> };

export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse> {
  const result = await requireAccount();
  if (unwrapAccount(result)) return result;

  const { botId, sourceId } = await context.params;
  const removed = await sourceService.remove(botId, result.account.id, sourceId);
  if (!removed) return jsonErr("Source not found", 404);

  return jsonAck();
}

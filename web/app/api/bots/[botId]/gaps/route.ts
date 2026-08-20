import { NextResponse } from "next/server";

import { requireAccount, unwrapAccount } from "server/auth/require-account";
import { jsonErr, jsonOk } from "server/http/json-api";
import { gapsService } from "server/services/gaps.service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ botId: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const result = await requireAccount();
  if (unwrapAccount(result)) return result;

  const { botId } = await context.params;
  const response = await gapsService.list(botId, result.account.id, result.account.plan);
  if (!response) return jsonErr("Bot not found", 404);

  return jsonOk(response);
}

import { NextResponse } from "next/server";

import { requireAccount, unwrapAccount } from "server/auth/require-account";
import { jsonErr, jsonOk } from "server/http/json-api";
import { conversationService } from "server/services/conversation.service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ botId: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const result = await requireAccount();
  if (unwrapAccount(result)) return result;

  const { botId } = await context.params;
  const summary = await conversationService.usageSummary(botId, result.account.id, result.account.plan);
  if (!summary) return jsonErr("Bot not found", 404);

  return jsonOk(summary);
}

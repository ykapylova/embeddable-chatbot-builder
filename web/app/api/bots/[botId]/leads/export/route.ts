import { NextResponse } from "next/server";

import { requireAccount, unwrapAccount } from "server/auth/require-account";
import { jsonErr } from "server/http/json-api";
import { leadService } from "server/services/lead.service";
import { PlanLimitError } from "server/services/plan.service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ botId: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const result = await requireAccount();
  if (unwrapAccount(result)) return result;

  const { botId } = await context.params;

  try {
    const csv = await leadService.exportCsv(botId, result.account.id, result.account.plan);
    if (csv === null) return jsonErr("Bot not found", 404);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leads-${botId}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof PlanLimitError) {
      return jsonErr(error.message, 402, { code: error.code });
    }
    throw error;
  }
}

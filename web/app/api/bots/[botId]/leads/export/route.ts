import { NextResponse } from "next/server";

import { requireAccount, unwrapAccount } from "server/auth/require-account";
import { jsonErr } from "server/http/json-api";
import { LeadExportNotAllowedError, leadService } from "server/services/lead.service";

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
    if (error instanceof LeadExportNotAllowedError) {
      return jsonErr(error.message, 403, { code: "PLAN_LIMIT" });
    }
    throw error;
  }
}

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireAccount, unwrapAccount } from "server/auth/require-account";
import { jsonErr, jsonOk } from "server/http/json-api";
import { SourceValidationError, sourceService } from "server/services/sources/source.service";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ botId: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const result = await requireAccount();
  if (unwrapAccount(result)) return result;

  const { botId } = await context.params;
  const sources = await sourceService.list(botId, result.account.id);
  if (!sources) return jsonErr("Bot not found", 404);

  return jsonOk(sources);
}

/**
 * One source is fully processed per request — parsed, chunked, embedded and
 * indexed — before the response returns. There is no queue: `maxDuration`
 * gives it up to 60 seconds to finish. Accepts `multipart/form-data` for a
 * file upload, JSON for url/text/faq.
 */
export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const result = await requireAccount();
  if (unwrapAccount(result)) return result;

  const { botId } = await context.params;
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const source = await sourceService.createFromFile(botId, result.account.id, formData);
      if (!source) return jsonErr("Bot not found", 404);
      return jsonOk(source, { status: 201 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonErr("Invalid JSON body", 400);
    }

    const source = await sourceService.create(botId, result.account.id, body);
    if (!source) return jsonErr("Bot not found", 404);
    return jsonOk(source, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonErr(error.issues[0]?.message ?? "Invalid payload", 422);
    }
    if (error instanceof SourceValidationError) {
      return jsonErr(error.message, 422);
    }
    console.error("[POST /api/bots/:botId/sources]", error);
    return jsonErr("Could not create source", 500);
  }
}

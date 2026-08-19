import { NextResponse } from "next/server";

import type { ApiAck, ApiOk } from "lib/api-types/envelope";

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse<ApiOk<T>> {
  return NextResponse.json({ data }, init);
}

export function jsonErr(error: string, status: number, opts?: { code?: string }): NextResponse {
  const body = opts?.code ? { error, code: opts.code } : { error };
  return NextResponse.json(body, { status });
}

export function jsonAck(init?: ResponseInit): NextResponse<ApiAck> {
  return NextResponse.json({ success: true }, init);
}

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { jsonErr } from "server/http/json-api";

export async function requireUserId(): Promise<{ userId: string } | NextResponse> {
  const { userId } = await auth();

  if (!userId) {
    return jsonErr("Unauthorized", 401);
  }

  return { userId };
}

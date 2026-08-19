import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { jsonErr } from "server/http/json-api";
import { accountRepository, type AccountRow } from "server/repositories/account.repository";

export type AuthedAccount = { account: AccountRow };

function isResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

export function unwrapAccount(result: AuthedAccount | NextResponse): result is NextResponse {
  return isResponse(result);
}

/**
 * Resolves the current user's account, creating it on first contact. Every
 * protected route starts here: the resulting accountId is carried into each
 * database query and is the data isolation boundary.
 */
export async function requireAccount(): Promise<AuthedAccount | NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return jsonErr("Unauthorized", 401);
  }

  const existing = await accountRepository.findByClerkUserId(userId);
  if (existing) {
    return { account: existing };
  }

  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    `${userId}@unknown.local`;

  return { account: await accountRepository.create(userId, email) };
}

"use client";

import { useClerk } from "@clerk/nextjs";

/**
 * The "Account" label next to the avatar. It sits in a row styled like the nav
 * links above it, so it read as a link while being inert text — the only click
 * targets were the 28px avatar and the sign-out icon. It opens the same Clerk
 * account modal the avatar's menu leads to.
 */
export function AccountLabelButton() {
  const { openUserProfile } = useClerk();

  return (
    <button
      type="button"
      onClick={() => openUserProfile()}
      className="flex-1 rounded-lg text-left transition hover:text-white"
    >
      Account
    </button>
  );
}

"use client";

import { SignOutButton } from "@clerk/nextjs";
import { LogOut } from "lucide-react";

/**
 * Clerk clones its single child, so the child has to be built on the client:
 * children handed across the server/client boundary arrive as a lazy node and
 * `React.Children.only` rejects them.
 */
export function SignOutIconButton() {
  return (
    // `afterSignOutUrl` on the provider decides where this lands.
    <SignOutButton>
      <button
        type="button"
        title="Sign out"
        aria-label="Sign out"
        className="rounded-full p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </SignOutButton>
  );
}

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { LayoutGrid, LogOut } from "lucide-react";

import { IconBadge } from "components/ui/icon-badge";
import { PageTransition } from "components/providers/page-transition";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen gap-4 p-3 sm:p-4">
      <aside className="hidden w-60 shrink-0 flex-col rounded-3xl bg-[var(--chrome)] p-4 text-[var(--chrome-foreground)] sm:flex">
        <Link href="/dashboard" className="mb-8 flex items-center gap-2 px-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
          <span className="text-base font-semibold">Docsy</span>
        </Link>

        <p className="px-2 text-xs font-medium tracking-wide text-white/40 uppercase">General</p>
        <nav className="mt-2 flex flex-col gap-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 rounded-xl px-2 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <IconBadge tone="chrome-active" size="sm">
              <LayoutGrid />
            </IconBadge>
            Dashboard
          </Link>
        </nav>

        <div className="mt-auto flex items-center gap-2.5 rounded-xl px-2 py-2 text-sm text-white/70">
          <UserButton />
          <span className="flex-1">Account</span>
          <LogOut className="h-4 w-4 opacity-60" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="mb-3 flex items-center justify-between rounded-2xl bg-[var(--chrome)] px-4 py-3 text-[var(--chrome-foreground)] sm:hidden">
          <Link href="/dashboard" className="text-base font-semibold">
            Docsy
          </Link>
          <UserButton />
        </header>

        <main className="min-w-0 flex-1">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

import logo from "app/logo.png";
import { AccountLabelButton } from "components/layout/account-label-button";
import { ConsoleMobileNav, ConsoleSidebarNav } from "components/layout/console-nav";
import { SignOutIconButton } from "components/layout/sign-out-icon-button";
import { PageTransition } from "components/providers/page-transition";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen gap-4 p-3 sm:p-4">
      <aside className="hidden w-60 shrink-0 flex-col rounded-3xl bg-[var(--chrome)] p-4 text-[var(--chrome-foreground)] sm:flex">
        <Link href="/dashboard" className="mb-8 flex items-center gap-2 rounded-xl px-2">
          <Image src={logo} alt="" width={24} height={24} className="rounded-lg" />
          <span className="text-base font-semibold">Docsy</span>
        </Link>

        <p className="px-2 text-xs font-medium tracking-wide text-white/40 uppercase">General</p>
        <ConsoleSidebarNav />

        <div className="mt-auto flex items-center gap-2.5 rounded-xl px-2 py-2 text-sm text-white/70">
          <UserButton />
          <AccountLabelButton />
          <SignOutIconButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="mb-3 flex flex-col gap-3 rounded-2xl bg-[var(--chrome)] px-4 py-3 text-[var(--chrome-foreground)] sm:hidden">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2 rounded-xl text-base font-semibold">
              <Image src={logo} alt="" width={22} height={22} className="rounded-lg" />
              Docsy
            </Link>
            <UserButton />
          </div>
          <ConsoleMobileNav />
        </header>

        <main className="min-w-0 flex-1">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}

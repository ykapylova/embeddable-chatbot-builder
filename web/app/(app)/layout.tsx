import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { LayoutGrid } from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--panel)] p-4 sm:flex">
        <Link href="/dashboard" className="mb-6 flex items-center gap-2 px-2">
          <span className="text-base font-semibold">Docsy</span>
        </Link>

        <nav className="flex flex-col gap-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--panel-soft)] hover:text-[var(--foreground)]"
          >
            <LayoutGrid className="h-4 w-4" />
            Bots
          </Link>
        </nav>

        <div className="mt-auto flex items-center gap-2 px-2 pt-4">
          <UserButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--panel)] px-4 py-3 sm:hidden">
          <Link href="/dashboard" className="text-base font-semibold">
            Docsy
          </Link>
          <UserButton />
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

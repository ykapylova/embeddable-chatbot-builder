import Image from "next/image";
import Link from "next/link";

import logo from "app/logo.png";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-[var(--muted)] sm:flex-row">
        <div className="flex items-center gap-2 font-medium text-[var(--foreground)]">
          <Image src={logo} alt="" width={20} height={20} className="rounded-xl" />
          Docsy
        </div>

        <nav className="flex items-center gap-5">
          <Link href="/#pricing" className="transition hover:text-[var(--foreground)]">
            Pricing
          </Link>
          <Link href="/#faq" className="transition hover:text-[var(--foreground)]">
            FAQ
          </Link>
          <Link href="/sign-in" className="transition hover:text-[var(--foreground)]">
            Sign in
          </Link>
        </nav>

        <p>© {new Date().getFullYear()} Docsy. Built for SaaS support teams.</p>
      </div>
    </footer>
  );
}

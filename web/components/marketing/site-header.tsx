import Image from "next/image";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

import { Button } from "components/ui/button";
import logo from "app/logo.png";

export async function SiteHeader() {
  const { userId } = await auth();

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Image src={logo} alt="" width={28} height={28} className="rounded-xl" />
          Docsy
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-[var(--muted)] sm:flex">
          <Link href="/#how-it-works" className="transition hover:text-[var(--foreground)]">
            How it works
          </Link>
          <Link href="/pricing" className="transition hover:text-[var(--foreground)]">
            Pricing
          </Link>
          <Link href="/#faq" className="transition hover:text-[var(--foreground)]">
            FAQ
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {userId ? (
            <Link href="/dashboard">
              <Button
                size="sm"
                className="border-0"
                style={{ background: "var(--brand-cta)" }}
              >
                Go to dashboard
              </Button>
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="hidden text-sm text-[var(--muted)] transition hover:text-[var(--foreground)] sm:inline"
              >
                Sign in
              </Link>
              <Link href="/sign-up">
                <Button
                  size="sm"
                  className="border-0"
                  style={{ background: "var(--brand-cta)" }}
                >
                  Build your bot free
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

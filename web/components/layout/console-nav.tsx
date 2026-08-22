"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, LayoutGrid } from "lucide-react";

import { IconBadge } from "components/ui/icon-badge";
import { cn } from "lib/utils";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/billing", label: "Billing", icon: CreditCard },
];

// Bots live under /bots/* but belong to the dashboard section: without this the
// whole console shows no current item as soon as you open a bot.
const sections: Record<string, string[]> = {
  "/dashboard": ["/dashboard", "/bots"],
  "/billing": ["/billing"],
};

function useCurrentHref() {
  const pathname = usePathname();
  return (
    items.find((item) =>
      (sections[item.href] ?? [item.href]).some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)),
    )?.href ?? null
  );
}

export function ConsoleSidebarNav() {
  const current = useCurrentHref();

  return (
    <nav className="mt-2 flex flex-col gap-1">
      {items.map((item) => {
        const isActive = item.href === current;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-2 py-2 text-sm transition",
              isActive ? "bg-white/10 font-medium text-white" : "text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            <IconBadge tone={isActive ? "chrome-active" : "chrome"} size="sm">
              <Icon />
            </IconBadge>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ConsoleMobileNav() {
  const current = useCurrentHref();

  return (
    <nav className="flex gap-1 overflow-x-auto">
      {items.map((item) => {
        const isActive = item.href === current;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition",
              isActive ? "bg-[var(--accent)] font-medium text-[var(--accent-foreground)]" : "bg-white/10 text-white/70",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

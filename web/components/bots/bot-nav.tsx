"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { cn } from "lib/utils";

export function BotNav({ botId }: { botId: string }) {
  const pathname = usePathname();
  const activeTabRef = useRef<HTMLAnchorElement>(null);

  // The strip scrolls at narrow widths, and the later tabs start out past the
  // right edge — landing on Install with "Playground" highlighted off-screen
  // reads as being on the wrong page.
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);

  const tabs = [
    // Exact match only: every other tab's href is also a prefix of this one.
    { href: `/bots/${botId}`, label: "Playground", exact: true },
    { href: `/bots/${botId}/knowledge`, label: "Knowledge" },
    { href: `/bots/${botId}/conversations`, label: "Conversations" },
    { href: `/bots/${botId}/leads`, label: "Leads" },
    { href: `/bots/${botId}/appearance`, label: "Appearance" },
    { href: `/bots/${botId}/install`, label: "Install" },
    { href: `/bots/${botId}/settings`, label: "Settings" },
  ];

  return (
    <nav className="flex gap-1 overflow-x-auto rounded-full bg-[var(--panel-soft)] p-1">
      {tabs.map((tab) => {
        const isActive = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            ref={isActive ? activeTabRef : undefined}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap transition",
              isActive
                ? "bg-[var(--chrome)] font-medium text-[var(--chrome-foreground)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

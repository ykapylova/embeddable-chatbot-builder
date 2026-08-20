"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "lib/utils";

export function BotNav({ botId }: { botId: string }) {
  const pathname = usePathname();

  const tabs = [
    { href: `/bots/${botId}`, label: "Playground" },
    { href: `/bots/${botId}/knowledge`, label: "Knowledge" },
    { href: `/bots/${botId}/settings`, label: "Settings" },
  ];

  return (
    <nav className="flex gap-1 border-b border-[var(--border)]">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition",
              isActive
                ? "border-[var(--accent)] font-medium text-[var(--foreground)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

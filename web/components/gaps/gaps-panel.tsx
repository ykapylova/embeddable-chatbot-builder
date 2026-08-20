"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Lock, MessageCircleQuestion } from "lucide-react";

import { getGaps } from "lib/api-client";
import { appPaths } from "lib/api-paths";
import { queryKeys } from "lib/query-keys";
import { GapRow } from "components/gaps/gap-row";
import { ProPill } from "components/widget-settings/plan-pill";
import { Button, buttonVariants } from "components/ui/button";
import { StatCard } from "components/ui/stat-card";
import { cn } from "lib/utils";

export function GapsPanel({ botId }: { botId: string }) {
  const query = useQuery({
    queryKey: queryKeys.gaps.list(botId),
    queryFn: () => getGaps(botId),
  });

  if (query.isPending) return <GapsPanelSkeleton />;

  if (query.isError) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 text-center">
        <p className="text-sm text-red-600">
          {query.error instanceof Error ? query.error.message : "Could not load content gaps"}
        </p>
        <Button variant="outline" className="mt-3" onClick={() => query.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const data = query.data;

  if (data.gated) {
    return (
      <div className="space-y-4">
        <StatCard
          tone="amber"
          label="Unanswered questions"
          icon={<MessageCircleQuestion />}
          value={data.count}
        />
        <div className="relative overflow-hidden rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel)] p-8 text-center">
          <Lock className="mx-auto mb-3 h-6 w-6 text-[var(--muted)]" />
          <h2 className="inline-flex items-center gap-2 text-base font-medium">
            See what your bot can&apos;t answer <ProPill />
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--muted)]">
            Upgrade to Pro to see the grouped list of questions, turn each one into an FAQ in one
            click, and collect a visitor&apos;s contact info the next time your bot can&apos;t help —
            a customer&apos;s contact could have been here.
          </p>
          <Link
            href={`${appPaths.billing()}?reason=GAPS_LOCKED`}
            className={cn(buttonVariants({ variant: "default" }), "mt-4 inline-flex")}
          >
            Upgrade plan
          </Link>
        </div>
      </div>
    );
  }

  if (data.items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel)] p-10 text-center">
        <MessageCircleQuestion className="mx-auto mb-3 h-8 w-8 text-[var(--muted)]" />
        <h2 className="text-base font-medium">No content gaps yet</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-[var(--muted)]">
          Questions the bot couldn&apos;t answer, or that got a 👎, will show up here — grouped, most
          frequent first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <StatCard
        tone="amber"
        label="Unanswered questions"
        icon={<MessageCircleQuestion />}
        value={data.count}
      />
      <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--panel)]">
        {data.items.map((item) => (
          <GapRow key={item.key} botId={botId} item={item} />
        ))}
      </ul>
    </div>
  );
}

function GapsPanelSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="h-24 animate-pulse rounded-3xl bg-[var(--panel-soft)]" />
      {[0, 1, 2].map((key) => (
        <div key={key} className="h-16 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)]" />
      ))}
    </div>
  );
}

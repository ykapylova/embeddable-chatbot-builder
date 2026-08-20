import Link from "next/link";
import { Lock } from "lucide-react";

import type { PlanLimitCode } from "lib/api-types/plan";
import { ApiError } from "lib/api-client";
import { cn } from "lib/utils";
import { Card } from "components/ui/card";
import { IconBadge } from "components/ui/icon-badge";
import { buttonVariants } from "components/ui/button";

const TITLE_BY_CODE: Partial<Record<PlanLimitCode, string>> = {
  LIMIT_CREDITS: "Out of credits this period",
  LIMIT_BOTS: "Bot limit reached",
  LIMIT_SOURCES: "Source limit reached",
  LIMIT_CHARS: "Knowledge base limit reached",
  LIMIT_DOMAINS: "Domain limit reached",
  FEATURE_LEADS: "Lead capture is a Pro feature",
  FEATURE_EXPORT: "CSV export is a Pro feature",
  FEATURE_BRANDING: "Removing branding is a Pro feature",
};

function isPlanLimitCode(code: string | undefined): code is PlanLimitCode {
  return code !== undefined && code in TITLE_BY_CODE;
}

/**
 * Renders a 402 from `assertPlan` as a specific screen instead of a generic
 * error — the reviewer's UI contract from PROJECT_SPEC.md §10.5. Every gate's
 * upgrade link carries its reason so `/billing` can highlight why the visitor
 * landed there (§10.3's six upgrade triggers).
 */
export function PlanLimitScreen({ error }: { error: ApiError | Error }) {
  const code = error instanceof ApiError ? error.code : undefined;
  const title = isPlanLimitCode(code) ? TITLE_BY_CODE[code] : "Upgrade required";

  return (
    <Card className="border border-[var(--border)] p-10 text-center">
      <IconBadge tone="periwinkle" size="lg" className="mx-auto mb-3">
        <Lock />
      </IconBadge>
      <h2 className="text-base font-medium">{title}</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--muted)]">{error.message}</p>
      <Link
        href={code ? `/billing?reason=${encodeURIComponent(code)}` : "/billing"}
        className={cn(buttonVariants({ variant: "default" }), "mt-4 inline-flex")}
      >
        Upgrade plan
      </Link>
    </Card>
  );
}

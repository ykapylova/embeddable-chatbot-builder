import Link from "next/link";

import { appPaths } from "lib/api-paths";
import { formatCount } from "lib/format";
import { cn } from "lib/utils";
import { usePlan } from "components/plan/use-plan";

/** The real per-bot character limit, read from `GET /api/me/plan` — never a hardcoded plan. */
export function KnowledgeCharUsage({ totalChars }: { totalChars: number }) {
  const { plan, isPlanResolved } = usePlan();
  if (!isPlanResolved || !plan) return null;

  const limit = plan.chars.limit;
  const percent = Math.min(100, (totalChars / limit) * 100);
  const isOverLimit = totalChars > limit;

  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className={isOverLimit ? "font-medium text-[var(--danger)]" : "text-[var(--foreground)]"}>
          {formatCount(totalChars)} of {formatCount(limit)} characters used
        </span>
        {isOverLimit ? (
          <Link href={`${appPaths.billing()}?reason=LIMIT_CHARS`} className="text-xs text-[var(--danger)] underline underline-offset-2">
            Over your plan&apos;s limit — upgrade
          </Link>
        ) : null}
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--panel-soft)]">
        <div
          className={cn("h-full rounded-full", isOverLimit ? "bg-[var(--danger)]" : "bg-[var(--accent)]")}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

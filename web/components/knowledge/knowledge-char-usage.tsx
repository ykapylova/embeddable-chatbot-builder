import { planLimits } from "lib/plans";
import { cn } from "lib/utils";

function formatChars(n: number): string {
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}m`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

/**
 * Billing (T11/T12) has not landed yet, so there is no endpoint that reports
 * the account's actual plan. Free is the schema default for a new account
 * (`server/db/schema.ts`), so it is the honest number to show until the
 * account's real plan can be read from the API.
 */
export function KnowledgeCharUsage({ totalChars }: { totalChars: number }) {
  const limit = planLimits("free").chars;
  const percent = Math.min(100, (totalChars / limit) * 100);
  const isOverLimit = totalChars > limit;

  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className={isOverLimit ? "font-medium text-red-600" : "text-[var(--foreground)]"}>
          {formatChars(totalChars)} of {formatChars(limit)} used
        </span>
        {isOverLimit ? (
          <span className="text-xs text-red-600">Over the free plan limit</span>
        ) : null}
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--panel-soft)]">
        <div
          className={cn("h-full rounded-full", isOverLimit ? "bg-red-600" : "bg-[var(--accent)]")}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

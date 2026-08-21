import Link from "next/link";

import { ApiError } from "lib/api-client";
import { appPaths } from "lib/api-paths";
import { parseUpgradeReason } from "components/billing/upgrade-reason";

/**
 * Inline twin of `PlanLimitScreen`, for the gates that block one control
 * rather than a whole screen: an add-source tab, a domain field, the new-bot
 * form. Same contract as the screen — a 402 carries a `code`, and the code is
 * what the upgrade link passes to `/billing` so it can say why the visitor
 * arrived (PROJECT_SPEC.md §10.3).
 *
 * Renders no wrapper. The caller keeps its own element, because these sites
 * disagree about the tag and the text size, and only about that.
 */
export function PlanLimitMessage({ error, fallback }: { error: unknown; fallback: string }) {
  const message = error instanceof Error ? error.message : fallback;
  const reason = error instanceof ApiError ? parseUpgradeReason(error.code ?? null) : null;

  return (
    <>
      {message}
      {reason ? (
        <>
          {" "}
          <Link
            href={`${appPaths.billing()}?reason=${reason}`}
            className="underline underline-offset-2"
          >
            Upgrade plan
          </Link>
        </>
      ) : null}
    </>
  );
}

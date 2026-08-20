"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";

import { getCheckoutSessionStatus } from "lib/api-client";
import { queryKeys } from "lib/query-keys";

/**
 * Stripe returns to `return_url` even when payment failed, so the redirect
 * itself proves nothing — only server-side verification does. Polls every
 * 2s while the session is `incomplete`. A failed verification request shows
 * a reassuring message, not an error: the money was probably taken and the
 * webhook will finish the job. PROJECT_SPEC.md §10.6.
 */
export function CheckoutReturn({ sessionId }: { sessionId: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.billing.sessionStatus(sessionId),
    queryFn: () => getCheckoutSessionStatus(sessionId),
    retry: false,
    refetchInterval: (q) => {
      if (q.state.error) return false;
      return q.state.data?.outcome === "incomplete" ? 2000 : false;
    },
  });

  useEffect(() => {
    if (query.data?.outcome === "succeeded") {
      void queryClient.invalidateQueries({ queryKey: queryKeys.plan.self });
    }
  }, [query.data?.outcome, queryClient]);

  if (query.isError) {
    return (
      <Banner icon={<Loader2 className="h-5 w-5 animate-spin" />}>
        Payment went through, syncing your plan.
      </Banner>
    );
  }

  if (!query.data || query.data.outcome === "incomplete") {
    return (
      <Banner icon={<Loader2 className="h-5 w-5 animate-spin" />}>Confirming your payment…</Banner>
    );
  }

  if (query.data.outcome === "expired") {
    return (
      <Banner tone="neutral">
        This checkout session expired. Nothing was charged — pick a plan below to try again.
      </Banner>
    );
  }

  return (
    <Banner tone="success" icon={<CheckCircle2 className="h-5 w-5" />}>
      Payment confirmed — your plan is updated.
    </Banner>
  );
}

export function CheckoutCancelled() {
  return <Banner tone="neutral">Checkout closed. Nothing was charged.</Banner>;
}

function Banner({
  tone = "loading",
  icon,
  children,
}: {
  tone?: "loading" | "success" | "neutral";
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "success"
      ? "border-[var(--chip-olive-fg)]/30 bg-[var(--chip-olive-bg)] text-[var(--chip-olive-fg)]"
      : tone === "neutral"
        ? "border-[var(--border)] bg-[var(--panel-soft)] text-[var(--foreground)]"
        : "border-[var(--chip-periwinkle-fg)]/30 bg-[var(--chip-periwinkle-bg)] text-[var(--chip-periwinkle-fg)]";

  return (
    <div className={`mb-4 flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-medium ${toneClass}`}>
      {icon}
      {children}
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { syncBilling } from "lib/api-client";
import { queryKeys } from "lib/query-keys";

/**
 * Runs once when the visitor lands back from the Billing Portal. A cancel or a
 * plan change made in there reaches us only through a webhook, which may be
 * minutes late or absent entirely in a local setup, so the page would otherwise
 * keep rendering the state from before the visit — most visibly, "Renews <date>"
 * on a subscription that has just been cancelled.
 *
 * Silent by design: nothing here is the visitor's problem. If the sync fails
 * the webhook is still coming, and the plan query below refetches regardless.
 */
export function PortalReturn() {
  const queryClient = useQueryClient();

  const sync = useMutation({
    mutationFn: syncBilling,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.plan.self });
    },
  });

  const { mutate } = sync;
  useEffect(() => {
    mutate();
  }, [mutate]);

  return null;
}

"use client";

import { TagPill } from "components/ui/tag-pill";

import { usePlan } from "./use-plan";

type GatedFeature = "leads" | "export" | "branding";

/**
 * A "Pro" tag next to an affordance the current plan cannot use yet. Gated
 * features stay visible and are marked, never hidden — PROJECT_SPEC.md §10.3:
 * "a hidden feature sells nothing."
 */
export function ProBadge({ feature, className }: { feature: GatedFeature; className?: string }) {
  const { plan, isLoading } = usePlan();
  if (isLoading || !plan) return null;

  const unlocked = feature === "branding" ? !plan.branding : plan[feature];
  if (unlocked) return null;

  return (
    <TagPill tone="periwinkle" className={className}>
      Pro
    </TagPill>
  );
}

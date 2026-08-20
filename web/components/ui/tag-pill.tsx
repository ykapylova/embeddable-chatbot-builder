import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "lib/utils";

const tagPillVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        amber: "bg-[var(--chip-amber-bg)] text-[var(--chip-amber-fg)]",
        rose: "bg-[var(--chip-rose-bg)] text-[var(--chip-rose-fg)]",
        olive: "bg-[var(--chip-olive-bg)] text-[var(--chip-olive-fg)]",
        periwinkle: "bg-[var(--chip-periwinkle-bg)] text-[var(--chip-periwinkle-fg)]",
        violet: "bg-[var(--chip-violet-bg)] text-[var(--chip-violet-fg)]",
        teal: "bg-[var(--chip-teal-bg)] text-[var(--chip-teal-fg)]",
        neutral: "bg-[var(--chip-neutral-bg)] text-[var(--chip-neutral-fg)]",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export type TagPillProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof tagPillVariants>;

function TagPill({ className, tone, ...props }: TagPillProps) {
  return <span className={cn(tagPillVariants({ tone }), className)} {...props} />;
}

export { TagPill, tagPillVariants };

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "lib/utils";

const iconBadgeVariants = cva("flex shrink-0 items-center justify-center rounded-xl", {
  variants: {
    tone: {
      chrome: "bg-white/10 text-[var(--chrome-foreground)]",
      "chrome-active": "bg-[var(--accent)] text-[var(--accent-foreground)]",
      amber: "bg-[var(--chip-amber-bg)] text-[var(--chip-amber-fg)]",
      rose: "bg-[var(--chip-rose-bg)] text-[var(--chip-rose-fg)]",
      olive: "bg-[var(--chip-olive-bg)] text-[var(--chip-olive-fg)]",
      periwinkle: "bg-[var(--chip-periwinkle-bg)] text-[var(--chip-periwinkle-fg)]",
      neutral: "bg-[var(--panel-soft)] text-[var(--muted)]",
    },
    size: {
      sm: "h-7 w-7 [&_svg]:h-3.5 [&_svg]:w-3.5",
      default: "h-9 w-9 [&_svg]:h-4 [&_svg]:w-4",
      lg: "h-11 w-11 [&_svg]:h-5 [&_svg]:w-5",
    },
  },
  defaultVariants: {
    tone: "neutral",
    size: "default",
  },
});

export type IconBadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof iconBadgeVariants>;

function IconBadge({ className, tone, size, ...props }: IconBadgeProps) {
  return <span className={cn(iconBadgeVariants({ tone, size }), className)} {...props} />;
}

export { IconBadge, iconBadgeVariants };

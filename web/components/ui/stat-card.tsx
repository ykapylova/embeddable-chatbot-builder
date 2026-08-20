import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "lib/utils";

const statCardVariants = cva("flex flex-col gap-3 rounded-3xl p-5", {
  variants: {
    tone: {
      amber: "bg-[var(--tone-amber-bg)] text-[var(--tone-amber-fg)]",
      rose: "bg-[var(--tone-rose-bg)] text-[var(--tone-rose-fg)]",
      olive: "bg-[var(--tone-olive-bg)] text-[var(--tone-olive-fg)]",
      periwinkle: "bg-[var(--tone-periwinkle-bg)] text-[var(--tone-periwinkle-fg)]",
      accent: "bg-[var(--tone-accent-bg)] text-[var(--tone-accent-fg)]",
    },
  },
  defaultVariants: {
    tone: "amber",
  },
});

export type StatCardProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof statCardVariants> & {
    label: string;
    icon?: React.ReactNode;
    value: React.ReactNode;
    unit?: string;
  };

function StatCard({ className, tone, label, icon, value, unit, children, ...props }: StatCardProps) {
  return (
    <div className={cn(statCardVariants({ tone }), className)} {...props}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium opacity-80">{label}</span>
        {icon ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/10 [&_svg]:h-4 [&_svg]:w-4">
            {icon}
          </span>
        ) : null}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tracking-tight">{value}</span>
        {unit ? <span className="text-xs font-medium opacity-70">{unit}</span> : null}
      </div>
      {children}
    </div>
  );
}

export { StatCard, statCardVariants };

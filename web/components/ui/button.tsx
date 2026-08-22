import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-medium transition duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 focus-visible:outline-[var(--foreground)] active:opacity-80",
        outline: "border border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--panel-soft)] active:bg-[var(--chip-neutral-bg)]",
        ghost: "text-[var(--muted)] hover:bg-[var(--panel-soft)] hover:text-[var(--foreground)] active:bg-[var(--chip-neutral-bg)]",
        destructive:
          "bg-[var(--danger)] text-[var(--danger-foreground)] hover:bg-[var(--danger-strong)] focus-visible:outline-[var(--foreground)] active:bg-[var(--danger-strong)]",
      },
      size: {
        default: "h-9 px-4 py-2 text-sm",
        sm: "h-8 rounded-full px-3 text-sm",
        lg: "h-11 rounded-full px-6 text-sm",
        icon: "h-9 w-9 rounded-full text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => {
    return <button className={cn(buttonVariants({ variant, size }), className)} ref={ref} type={type} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

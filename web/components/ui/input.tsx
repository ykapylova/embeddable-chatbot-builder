import * as React from "react";

import { cn } from "lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        className={cn(
          "w-full rounded-full border border-[var(--border)] bg-[var(--panel)] px-4 py-2 text-sm transition focus:border-[var(--accent)]",
          className,
        )}
        ref={ref}
        type={type}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };

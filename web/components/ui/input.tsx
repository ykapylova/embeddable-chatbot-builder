import * as React from "react";

import { cn } from "lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        className={cn(
          "w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm outline-none transition focus:border-[#c9d0dd]",
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

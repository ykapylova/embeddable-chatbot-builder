import * as React from "react";

import { cn } from "lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-3xl bg-[var(--panel)] p-5", className)}
      {...props}
    />
  );
}

export { Card };

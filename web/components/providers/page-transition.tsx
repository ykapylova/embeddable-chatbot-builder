"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  // Replaying the animation by re-adding the class, rather than by giving the
  // wrapper a `key={pathname}`, is what keeps the console's shared chrome
  // mounted across a navigation. A changing key tears down everything below it
  // on every tab click — the bot header included — so the title blanked and
  // re-rendered from scratch each time, which is most of what made switching
  // tabs feel slow.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    node.classList.remove("animate-page-fade-in");
    // Reading layout forces the removal to take effect before the class comes
    // back; without it the browser coalesces both changes and never restarts.
    void node.offsetWidth;
    node.classList.add("animate-page-fade-in");
  }, [pathname]);

  return (
    <div ref={ref} className="animate-page-fade-in">
      {children}
    </div>
  );
}

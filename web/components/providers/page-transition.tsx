"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

type TransitionScope = "console" | "bot-tab";

/**
 * A bot's tabs are one page to the console: `/bots/:id/knowledge` and
 * `/bots/:id/leads` share the header and the tab strip, so moving between them
 * must not replay the console-level fade over that chrome. The bot layout runs
 * its own `bot-tab` transition around the tab content instead.
 */
function transitionKey(pathname: string, scope: TransitionScope) {
  if (scope === "bot-tab") return pathname;
  const bot = /^\/bots\/[^/]+/.exec(pathname);
  return bot ? bot[0] : pathname;
}

export function PageTransition({
  children,
  scope = "console",
}: {
  children: React.ReactNode;
  scope?: TransitionScope;
}) {
  const key = transitionKey(usePathname(), scope);
  const ref = useRef<HTMLDivElement>(null);
  const lastKey = useRef(key);

  // Replaying the animation by re-adding the class, rather than by giving the
  // wrapper a `key`, is what keeps the console's shared chrome mounted across a
  // navigation. A changing key tears down everything below it on every tab
  // click — the bot header included — so the title blanked and re-rendered
  // from scratch each time, which is most of what made switching tabs feel slow.
  useEffect(() => {
    const node = ref.current;
    if (!node || lastKey.current === key) return;
    lastKey.current = key;

    node.classList.remove("animate-page-fade-in");
    // Reading layout forces the removal to take effect before the class comes
    // back; without it the browser coalesces both changes and never restarts.
    void node.offsetWidth;
    node.classList.add("animate-page-fade-in");
  }, [key]);

  // The tab content does not fade on mount: opening a bot already fades the
  // whole page in at console level, and a second fade inside it would stack.
  return (
    <div ref={ref} className={scope === "console" ? "animate-page-fade-in" : undefined}>
      {children}
    </div>
  );
}

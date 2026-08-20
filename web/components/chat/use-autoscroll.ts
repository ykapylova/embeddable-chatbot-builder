import { useCallback, useEffect, useRef } from "react";

/** Close enough to the bottom to count as "at the bottom" despite subpixel scroll rounding. */
const BOTTOM_THRESHOLD_PX = 48;

/**
 * Keeps a scroll container pinned to the bottom while new content streams in
 * — but only while the reader hasn't scrolled up to look at something else.
 * Scrolling up even a little turns autoscroll off until they return to the
 * bottom themselves; nothing here ever yanks the viewport back down.
 */
export function useAutoscroll<T>(dependency: T) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom <= BOTTOM_THRESHOLD_PX;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [dependency]);

  return { containerRef, handleScroll };
}

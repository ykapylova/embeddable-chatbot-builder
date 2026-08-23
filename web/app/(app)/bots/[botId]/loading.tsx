/**
 * Without this boundary a tab click has no visible effect until the whole RSC
 * payload for the next tab has arrived: the router keeps the previous tab on
 * screen and the console reads as frozen. The skeleton lands immediately and
 * the header and the tab strip above it stay put, so the click is answered
 * even when the segment behind it is slow.
 */
export default function BotTabLoading() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="h-24 animate-pulse rounded-3xl bg-[var(--panel-soft)]" />
      <div className="h-16 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)]" />
      <div className="h-16 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)]" />
    </div>
  );
}

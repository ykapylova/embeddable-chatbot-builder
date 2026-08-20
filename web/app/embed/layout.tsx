/**
 * This subtree is only ever loaded as the document inside the widget's
 * iframe — never navigated to directly by a visitor. The root layout's
 * `body` background is meant for the app shell; overriding it here keeps
 * the iframe itself transparent, so only `ChatSurface`'s own rounded panel
 * is visible and the customer's page shows through everywhere else.
 */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`html, body { background: transparent; height: 100%; }`}</style>
      {children}
    </>
  );
}

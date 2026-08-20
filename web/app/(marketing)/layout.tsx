import { DemoWidget } from "components/marketing/demo-widget";
import { SiteFooter } from "components/marketing/site-footer";
import { SiteHeader } from "components/marketing/site-header";
import { PageTransition } from "components/providers/page-transition";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
      <SiteFooter />
      <DemoWidget />
    </div>
  );
}

import { DemoWidget } from "components/marketing/demo-widget";
import { SiteFooter } from "components/marketing/site-footer";
import { SiteHeader } from "components/marketing/site-header";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <DemoWidget />
    </div>
  );
}

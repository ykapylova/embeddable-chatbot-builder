import { Suspense } from "react";

import { BillingPage } from "components/billing/billing-page";

export const metadata = { title: "Billing — Docsy" };

export default function BotBillingPage() {
  return (
    <Suspense>
      <BillingPage />
    </Suspense>
  );
}

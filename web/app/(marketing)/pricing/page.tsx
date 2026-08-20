import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";

import { PLAN_CATALOGUE } from "lib/plans";
import { Faq } from "components/marketing/faq";
import { PricingSection } from "components/marketing/pricing-section";

export const metadata: Metadata = {
  title: "Pricing — Docsy",
  description: "Simple, credit-based pricing for the Docsy support bot.",
};

export default async function PricingPage() {
  const { userId } = await auth();
  const signedIn = Boolean(userId);

  return (
    <>
      <div className="px-6 pt-16 text-center">
        <h1 className="text-3xl font-semibold sm:text-4xl">Pricing</h1>
        <p className="mx-auto mt-3 max-w-lg text-[var(--muted)]">
          Pay for answers, not for seats. Every plan includes citations and the honest fallback.
        </p>
      </div>
      <PricingSection plans={PLAN_CATALOGUE} signedIn={signedIn} />
      <Faq />
    </>
  );
}

import { auth } from "@clerk/nextjs/server";

import { PLAN_CATALOGUE } from "lib/plans";
import { EmbedSnippet } from "components/marketing/embed-snippet";
import { Faq } from "components/marketing/faq";
import { FeatureCards } from "components/marketing/feature-cards";
import { FinalCta } from "components/marketing/final-cta";
import { Hero } from "components/marketing/hero";
import { HowItWorks } from "components/marketing/how-it-works";
import { LiveDemoPlaceholder } from "components/marketing/live-demo-placeholder";
import { PricingSection } from "components/marketing/pricing-section";

export default async function MarketingPage() {
  const { userId } = await auth();
  const signedIn = Boolean(userId);

  return (
    <>
      <Hero signedIn={signedIn} />
      <LiveDemoPlaceholder />
      <HowItWorks />
      <FeatureCards />
      <EmbedSnippet />
      <PricingSection plans={PLAN_CATALOGUE} signedIn={signedIn} />
      <Faq />
      <FinalCta signedIn={signedIn} />
    </>
  );
}

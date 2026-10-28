import { PricingHero } from "@/components/pricing/PricingHero";
import { WhatOneCreditStarts } from "@/components/pricing/WhatOneCreditStarts";
import { BillingDetails } from "@/components/pricing/BillingDetails";
import { PricingCTA } from "@/components/pricing/PricingCTA";
import { PricingExperience } from "@/components/pricing/PricingExperience";
import { pricingFAQData, pricingJsonLd } from "@/components/pricing/pricing-content";
import { FAQAccordion } from "@/components/common/FAQAccordion";
import { createPageMetadata, pageSeo } from "@/lib/seo";
import styles from "@/components/pricing/pricing-v22.module.css";

export const metadata = createPageMetadata(pageSeo.pricing);

export default function PricingPage() {
  return <div className={styles.page}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }} />
    <PricingExperience>
      <PricingHero />
      <WhatOneCreditStarts />
      <BillingDetails />
      <PricingCTA />
      <FAQAccordion tag="FAQ" title="Common questions" items={pricingFAQData} initialOpenIndex={null} collapsible />
    </PricingExperience>
  </div>;
}

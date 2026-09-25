import { PricingHero } from "@/components/pricing/PricingHero";
import { WhatOneCreditStarts } from "@/components/pricing/WhatOneCreditStarts";
import { BillingDetails } from "@/components/pricing/BillingDetails";
import { PricingCTA } from "@/components/pricing/PricingCTA";
import { FAQAccordion } from "@/components/common/FAQAccordion";
import { CreditPaymentReturnStatus } from "@/components/pricing/CreditPurchaseButton";
import { createPageMetadata, pageSeo } from "@/lib/seo";

const pricingFAQData = [
  {
    question: 'Is this a recurring subscription?',
    answer: 'No. Credits are one-time purchases and never expire.',
  },
  {
    question: 'What does one credit cover?',
    answer: 'One credit starts one complete Prospect Analysis or one Verified Action Plan generation. The same account balance works across all of your Cases.',
  },
  {
    question: 'When is a credit used?',
    answer: 'Entering a website and confirming the business is free. A credit is used when competitor discovery starts a complete Prospect Analysis, or when a Verified Action Plan generation starts.',
  },
  {
    question: 'What happens if a paid workflow fails?',
    answer: 'If it fails for a technical reason, exactly one credit is returned automatically. Starting a new generation or retry later uses one credit again.',
  },
  {
    question: 'Does adding or correcting a competitor use another credit?',
    answer: 'No. While the current Prospect workflow remains active, you can add or correct a competitor and continue without another credit.',
  },
  {
    question: 'Do credits expire?',
    answer: 'No. The five credits granted to a new account and any additional purchased credits do not expire.',
  },
  {
    question: 'Are Google connections and synchronization charged?',
    answer: 'No. Connecting or synchronizing Search Console and Analytics does not use a credit. Generating the Verified Action Plan uses one credit.',
  },
  {
    question: 'Can an unused purchased credit be refunded?',
    answer: 'An unused purchased credit may be refunded after the payment provider confirms the reversal. If it has already been used, the request requires manual review.',
  },
  {
    question: 'Is payment handled securely?',
    answer: 'Yes. All payments are processed securely via Dodo Payments.',
  },
];

export const metadata = createPageMetadata(pageSeo.pricing);

const pricingJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: pricingFAQData.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

export default function PricingPage() {
  return (
    <div className="bg-[#F8F9FB] min-h-screen selection:bg-[#A5D020]/30">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }}
      />
      <div className="px-6 pt-8"><CreditPaymentReturnStatus /></div>
      <PricingHero />
      <WhatOneCreditStarts />
      <BillingDetails />
      <PricingCTA />
      <FAQAccordion tag="FAQ" title={"Common\nquestions"} items={pricingFAQData} />
    </div>
  );
}

import { Suspense } from "react";
import { PricingHero } from "@/components/pricing/PricingHero";
import { WhoThisIsFor } from "@/components/pricing/WhoThisIsFor";
import { BillingDetails } from "@/components/pricing/BillingDetails";
import { DeliveryRefund } from "@/components/pricing/DeliveryRefund";
import { PricingCTA } from "@/components/pricing/PricingCTA";
import { PricingPaymentNotice } from "@/components/pricing/PricingPaymentNotice";
import { FAQAccordion } from "@/components/common/FAQAccordion";
import { createPageMetadata, pageSeo } from "@/lib/seo";

const pricingFAQData = [
  {
    question: 'Is this a recurring subscription?',
    answer: 'No. This is a one-time purchase.',
  },
  {
    question: 'Does one purchase include multiple pages?',
    answer: 'No. Each purchase covers one single URL.',
  },
  {
    question: 'Do I need a contract?',
    answer: 'No contract is required for a single report purchase.',
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
      <Suspense fallback={null}>
        <PricingPaymentNotice />
      </Suspense>
      <PricingHero />
      <WhoThisIsFor />
      <BillingDetails />
      <DeliveryRefund />
      <PricingCTA />
      <FAQAccordion tag="FAQ" title={"Common\nquestions"} items={pricingFAQData} />
    </div>
  );
}

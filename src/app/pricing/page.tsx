import { PricingHero } from "@/components/pricing/PricingHero";
import { WhoThisIsFor } from "@/components/pricing/WhoThisIsFor";
import { BillingDetails } from "@/components/pricing/BillingDetails";
import { DeliveryRefund } from "@/components/pricing/DeliveryRefund";
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
    answer: 'One credit starts one complete Prospect analysis or one Verified generation. Technical generation failures return the credit.',
  },
  {
    question: 'Do free credits expire?',
    answer: 'No. Every new account receives five permanent credits once.',
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
      <WhoThisIsFor />
      <BillingDetails />
      <DeliveryRefund />
      <PricingCTA />
      <FAQAccordion tag="FAQ" title={"Common\nquestions"} items={pricingFAQData} />
    </div>
  );
}

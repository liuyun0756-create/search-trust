import { PricingHero } from "@/components/pricing/PricingHero";
import { WhoThisIsFor } from "@/components/pricing/WhoThisIsFor";
import { BillingDetails } from "@/components/pricing/BillingDetails";
import { DeliveryRefund } from "@/components/pricing/DeliveryRefund";
import { PricingCTA } from "@/components/pricing/PricingCTA";
import { FAQAccordion } from "@/components/common/FAQAccordion";

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
    question: 'Is payment handled securely?',
    answer: 'Yes. All payments are processed securely via Dodo Payments.',
  },
];

export const metadata = {
  title: "Pricing — SearchTrust",
  description:
    "Simple one-time pricing for a SearchTrust trust audit report. No subscriptions, no hidden fees.",
};

export default function PricingPage() {
  return (
    <div className="bg-[#F8F9FB] min-h-screen selection:bg-[#A5D020]/30">
      <PricingHero />
      <WhoThisIsFor />
      <BillingDetails />
      <DeliveryRefund />
      <PricingCTA />
      <FAQAccordion tag="FAQ" title={"Common\nquestions"} items={pricingFAQData} />
    </div>
  );
}

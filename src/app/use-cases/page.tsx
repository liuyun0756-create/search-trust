import { UseCasesV22 } from "@/components/useCase/UseCasesV22";
import { FAQAccordion } from "@/components/common/FAQAccordion";

const useCasesFAQData = [
  {
    question: "Can I start without client analytics access?",
    answer:
      "Yes. The Prospect stage starts with the website, available public business information and a confirmed relevant competitor. Search Console and GA4 can be added later when you continue the Case with client access. Public observations remain separate from questions for the client.",
  },
  {
    question: "Can I use it for a client I already serve?",
    answer:
      "Yes, through a completed Prospect Case. Continue that Case with client confirmation and eligible data access. Direct service-only setup is not available yet.",
  },
  {
    question: "What if I disagree with the proposed work?",
    answer:
      "You can adjust the action plan’s order, scope, steps, owner, timing, completion checks and review arrangements. Original observations remain unchanged. Save and approve the edited plan version before preparing a new client delivery.",
  },
  {
    question: "Does this replace my other SEO tools?",
    answer:
      "SearchTrust organizes supported evidence, findings and proposed actions into a plan you can review. You still carry out specialist checks, client communication and the agreed optimization work.",
  },
  {
    question: "Does choosing a situation use a credit?",
    answer:
      "No. Exploring this page and choosing an entry do not start analysis or use a credit. Website entry and business confirmation are free. Starting competitor discovery and the full Prospect analysis uses 1 credit; generating or regenerating a Verified Action Plan uses 1 credit. See Pricing for the current details.",
  },
];
import { createPageMetadata, pageSeo } from "@/lib/seo";

export const metadata = createPageMetadata(pageSeo.useCases);

const useCasesJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: useCasesFAQData.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

export default function UseCasesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(useCasesJsonLd) }}
      />
      <UseCasesV22 />
      <FAQAccordion
        tag="BEFORE YOU START"
        title={"A few things to know\nbefore you begin"}
        items={useCasesFAQData}
      />
    </>
  );
}

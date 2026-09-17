import { UseCasesV22 } from "@/components/useCase/UseCasesV22";
import { FAQAccordion } from "@/components/common/FAQAccordion";

const useCasesFAQData = [
  {
    question: 'Which use case is best for agencies?',
    answer: 'Use Prospect before the engagement to build a defensible client case from public evidence. After the client connects GSC and GA4, use Verified to turn observed performance into a prioritized action plan.',
  },
  {
    question: 'Can I use SearchTrust before publishing pages?',
    answer: 'Yes, provided the page is publicly accessible to the audit workflow. It can identify weak local grounding, template risk, and trust gaps before a public rollout.',
  },
  {
    question: 'Is it useful for AI-generated local pages?',
    answer: 'Yes. It helps identify whether pages look generic, templated, or weakly grounded. AI-generated pages often pass surface-level checks but fail trust signals at deeper layers.',
  },
  {
    question: 'Does it replace rank tracking tools?',
    answer: 'No. It complements them by diagnosing trust-related structural failure. Rank tracking tells you what happened; SearchTrust explains why it happened from a trust perspective.',
  },
  {
    question: 'Is this only for local SEO?',
    answer: 'SearchTrust V2.2 is built for local pages and local trust diagnosis. Its 8-layer framework is designed for pages that need to establish entity authority, evidence, and accountability in local search contexts.',
  },
  {
    question: 'Can multi-location brands use it?',
    answer: 'Yes. Create a Case for each priority business or location so its identity, competitors, evidence and connected performance data stay correctly separated.',
  },
  {
    question: 'Does SearchTrust manage or monitor GBP?',
    answer: 'No. SearchTrust observes public GBP information through search data and compares it with the site and Case identity. It does not edit, manage or continuously monitor the profile.',
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
      <FAQAccordion tag="FAQ" title={"Frequently asked\nquestions"}  items={useCasesFAQData} />
    </>
  );
}

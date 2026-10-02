import { UseCasesV22 } from "@/components/useCase/UseCasesV22";
import { FAQAccordion } from "@/components/common/FAQAccordion";

const useCasesFAQData = [
  {
    question: 'Do I need client access before I can use SearchTrust?',
    answer: 'No. The prospect stage uses the website, public business information and confirmed competitors to find specific questions worth discussing. Search Console and GA4 are added later when the client work requires performance verification.',
  },
  {
    question: 'What if a competitor has a page that the client does not?',
    answer: 'A competitor page is an observation, not proof that the client should copy it. SearchTrust helps check whether the client already has a relevant page, whether it receives related demand and whether a new page fits the business and evidence available.',
  },
  {
    question: 'Can it resolve conflicting website and business information automatically?',
    answer: 'It can surface the exact fields and sources that disagree, but the business still needs to confirm the correct information. The result is a traceable confirmation and correction list, not an automatic change to a public profile.',
  },
  {
    question: 'Does SearchTrust prove why a page is not generating enough enquiries?',
    answer: 'No. Search Console and GA4 can show how users find and interact with a page, while data checks can reveal measurement limits. They narrow the next question without turning one metric into a guaranteed causal explanation.',
  },
  {
    question: 'Can I change the recommended order of work?',
    answer: 'Yes. SearchTrust organizes evidence into a recommended starting point, while the SEO decides how client goals, resources, dependencies and release timing change the final order.',
  },
  {
    question: 'How should I explain the result to a client?',
    answer: 'Keep planned, implemented and reviewed work separate. The report should show the problem, the supporting evidence, the next action and what still needs confirmation. Changes in a metric should be described with their limits and review context.',
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

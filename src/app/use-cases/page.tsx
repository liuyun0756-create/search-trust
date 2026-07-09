import { UseCasesHero } from "@/components/useCase/UseCasesHero";
import { WhyTeamsTurnToUs } from "@/components/useCase/WhyTeamsTurnToUs";
import { PrimaryUseCasesOverview } from "@/components/useCase/PrimaryUseCasesOverview";
import { UseCasesByTeam } from "@/components/useCase/UseCasesByTeam";
import { WorkflowSection } from "@/components/useCase/WorkflowSection";
import { WhatTeamsGet } from "@/components/useCase/WhatTeamsGet";
import { FAQAccordion } from "@/components/common/FAQAccordion";

const useCasesFAQData = [
  {
    question: 'Which use case is best for agencies?',
    answer: 'Agency reporting + pre-publish review + stuck page diagnosis. These three use cases cover the most common agency needs: validating pages before they go live, diagnosing why existing pages underperform, and communicating findings to clients in a structured way.',
  },
  {
    question: 'Can I use SearchTrust before publishing pages?',
    answer: 'Yes, that is one of the clearest MVP use cases. Run a trust audit on any URL — including staging or preview URLs — to catch structural trust issues before they reach search engines.',
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
    answer: 'The MVP is primarily built for local pages and local trust diagnosis. The v2.1 8-layer framework is designed for pages that need to establish entity authority, evidence, and accountability in local search contexts.',
  },
  {
    question: 'Can multi-location brands use it?',
    answer: 'Yes, especially for reviewing page differentiation and local grounding. Multi-location brands can audit across all location pages to ensure consistency and standalone value.',
  },
];
import {WorkflowIntegrations} from "@/components/useCase/WorkflowIntegrations";
import { RelatedResources } from "@/components/useCase/RelatedResources";
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
      <UseCasesHero />
      <WhyTeamsTurnToUs />
      <PrimaryUseCasesOverview />
      <UseCasesByTeam />
      <WorkflowIntegrations />
      {/* <WorkflowSection /> */}
      <WhatTeamsGet />
            <RelatedResources />

      <FAQAccordion tag="FAQ" title={"Frequently asked\nquestions"}  items={useCasesFAQData} />
    </>
  );
}

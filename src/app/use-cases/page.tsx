import { UseCasesHero } from "@/components/useCase/UseCasesHero";
import { WhyTeamsTurnToUs } from "@/components/useCase/WhyTeamsTurnToUs";
import { CommunityScenario } from "@/components/useCase/CommunityScenario";
import { PrimaryUseCasesOverview } from "@/components/useCase/PrimaryUseCasesOverview";
import { UseCasesByTeam } from "@/components/useCase/UseCasesByTeam";
import { WorkflowSection } from "@/components/useCase/WorkflowSection";
import { WhatTeamsGet } from "@/components/useCase/WhatTeamsGet";
import { FAQAccordion } from "@/components/common/FAQAccordion";

const useCasesFAQData = [
  {
    question: 'Which use case is best for agencies?',
    answer: 'Start with a one-time client audit and proposal. The full audit supports internal diagnosis and scoping, while the client preview and client-ready PDF explain the problem, priority, and recommended work without exposing internal evidence detail.',
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
    answer: 'The MVP is primarily built for local pages and local trust diagnosis. The v2.1 8-layer framework is designed for pages that need to establish entity authority, evidence, and accountability in local search contexts.',
  },
  {
    question: 'Can multi-location brands use it?',
    answer: 'Yes. The current product audits one priority URL at a time, so multi-location teams can sample high-value or underperforming pages before applying the findings more broadly.',
  },
  {
    question: 'Does SearchTrust manage or monitor GBP?',
    answer: 'No. When public GBP data is available, Business Presence Audit adds a one-time, non-scoring review of page alignment, profile activity, and a recent review sample. It is not an ongoing GBP management or monitoring service.',
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
      <CommunityScenario />
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

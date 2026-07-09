import { FrameworkHero } from "@/components/framework/FrameworkHero";
import { WhyFrameworkExists } from "@/components/framework/WhyFrameworkExists";
import { TrustCollapseMeaning } from "@/components/framework/TrustCollapseMeaning";
import { SixLayersOverview } from "@/components/framework/SixLayersOverview";
import { LayerDetailBreakdown } from "@/components/framework/LayerDetailBreakdown";
import { TrustCollapseFlow } from "@/components/framework/TrustCollapseFlow";
import { WhatFrameworkIsNot } from "@/components/framework/WhatFrameworkIsNot";
import { FrameworkInProduct } from "@/components/framework/FrameworkInProduct";
import { ExampleFailTrust } from "@/components/framework/ExampleFailTrust";
import { FAQAccordion } from "@/components/common/FAQAccordion";
import { createPageMetadata, pageSeo } from "@/lib/seo";

const frameworkFAQData = [
  {
    question: "Why eight layers?",
    answer: "Because local page trust is not built by one signal. The v2.1 framework separates foundation, entity presence, entity consistency, specificity, real-world connection, accountability, page unique value, and algorithm fit so the report can show where trust actually breaks.",
  },
  {
    question: "Are all layers equally important?",
    answer: "No. The layers are not equally important, and they often depend on each other. Earlier layers usually support later ones.",
  },
  {
    question: "Is this only for local pages?",
    answer: "Yes. It may still rank in the short term, but the structure is usually less stable.",
  },
  {
    question: "How is this different from E-E-A-T?",
    answer: "E-E-A-T is a broad quality lens. SearchTrust is a page and entity trust diagnosis model built for local pages and agency reporting.",
  },
  {
    question: "Is this only for Google?",
    answer: "Mainly for Google and local search today, but it also considers AI citation environments.",
  },
  {
    question: "Is this just another content quality checklist?",
    answer: "No. It focuses on layered qualification and interpretation, not just content quality checks.",
  },
  {
    question: "Does this replace technical SEO?",
    answer: "No. Technical SEO and this framework focus on different things. Both are important.",
  },
];

export const metadata = createPageMetadata(pageSeo.framework);

const frameworkJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: frameworkFAQData.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

export default function FrameworkPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(frameworkJsonLd) }}
      />
      <FrameworkHero />
      <WhyFrameworkExists />
      <TrustCollapseMeaning />
      <SixLayersOverview />
      <LayerDetailBreakdown />
      <TrustCollapseFlow />
      <WhatFrameworkIsNot />
      <FrameworkInProduct />
      <ExampleFailTrust />
      <FAQAccordion tag="FAQ" title={"Frequently asked\nquestions"} items={frameworkFAQData} />
    </>
  );
}

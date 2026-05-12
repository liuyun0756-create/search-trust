import { FrameworkHero } from "@/components/framework/FrameworkHero";
import { WhyFrameworkExists } from "@/components/framework/WhyFrameworkExists";
import { TrustCollapseMeaning } from "@/components/framework/TrustCollapseMeaning";
import { SixLayersOverview } from "@/components/framework/SixLayersOverview";
import { LayerDetailBreakdown } from "@/components/framework/LayerDetailBreakdown";
import { TrustCollapseFlow } from "@/components/framework/TrustCollapseFlow";
import { WhatFrameworkIsNot } from "@/components/framework/WhatFrameworkIsNot";
import { FrameworkInProduct } from "@/components/framework/FrameworkInProduct";
import { FAQAccordion } from "@/components/common/FAQAccordion";

const frameworkFAQData = [
  {
    question: "Why six layers?",
    answer: "Because trust is not built by random signals. It forms through a structured sequence, and six layers describe that structure more clearly than scattered factors.",
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
    answer: "E-E-A-T is a broad quality lens. L0–L5 is a page-structure diagnosis model.",
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

export const metadata = {
  title: "The L0–L5 Trust Collapse Model — SearchTrust",
  description:
    "A structural framework for diagnosing whether a local page qualifies as a trustworthy entry point for Google, local search, and AI-era citation systems.",
};

export default function FrameworkPage() {
  return (
    <>
      <FrameworkHero />
      <WhyFrameworkExists />
      <TrustCollapseMeaning />
      <SixLayersOverview />
      <LayerDetailBreakdown />
      <TrustCollapseFlow />
      <WhatFrameworkIsNot />
      <FrameworkInProduct />
      <FAQAccordion tag="FAQ" title={"Frequently asked\nquestions"} items={frameworkFAQData} />
    </>
  );
}

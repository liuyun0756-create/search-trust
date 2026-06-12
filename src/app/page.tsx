import { HeroSection } from "@/components/home/HeroSection";
import { InsightEngine } from "@/components/home/InsightEngine";
import { LocalPage } from "@/components/home/LocalPage";
import { HowItWorks } from "@/components/home/HowItWorks";
import { ProductDemo } from "@/components/home/ProductDemo";
import { HowItWorksSteps } from "@/components/home/HowItWorksSteps";
import {ReportPreview} from "@/components/home/ReportPreview";
import { Diagnosis } from "@/components/home/Diagnosis";
import {AuditSection} from "@/components/home/AuditSection";
import {CommonWaysSection} from "@/components/home/CommonWaysSection";
import {ComparisonTable} from "@/components/home/ComparisonTable";
import {ProductRoadmap} from "@/components/home/ProductRoadmap";
import { FAQAccordion } from "@/components/common/FAQAccordion";
import {AuditForm} from "@/components/common/AuditForm";
import {WhatYouGet} from "@/components/home/WhatYouGet";
import { ProductDefinition } from "@/components/home/ProductDefinition";

const homeFAQData = [
  {
    question: "How is SearchTrust different from a standard SEO audit tool?",
    answer: "Standard SEO tools measure performance signals: backlinks, traffic, content length, technical errors. SearchTrust diagnoses trust signals — specifically why Google might withhold trust from a page even when standard signals look correct. It's a different instrument for a different question."
  },
  {
    question: "What is the L0–L5 Trust Collapse Model?",
    answer: "The L0-L5 model is a structural framework designed to diagnose whether a page qualifies as a real local entity entry point, covering layers from basic qualification to modern era-fit."
  },
  {
    question: "Does SearchTrust work for any type of local page?",
    answer: "Yes, it is designed for service area businesses, multi-location brands, and local lead-gen pages that need to establish entity authority."
  },
  {
    question: "Is this a replacement for my existing SEO tools?",
    answer: "No, it's a diagnostic layer that sits on top of tools like Ahrefs or Semrush to explain the 'why' behind ranking plateaus that those tools can't detect."
  },
  {
    question: "How long does a trust audit take?",
    answer: "A single-page audit is processed in real-time, typically providing a full Trust Collapse Report in under 60 seconds."
  },
  {
    question: "Can I run trust audits in bulk?",
    answer: "Bulk auditing is available for enterprise teams managing hundreds or thousands of location pages simultaneously."
  }
];
// import { CTABanner } from "@/components/home/CTABanner";

export default function Home() {
  return (
    <>
      <HeroSection />
      {/* <AuditForm /> */}
      <WhatYouGet />
      <InsightEngine />
      <LocalPage />
      <ProductDefinition />
      <HowItWorks />
      <ProductDemo />
      <HowItWorksSteps />
      <ReportPreview />
      <Diagnosis />
      <AuditSection />
      <CommonWaysSection />
      <ComparisonTable />
      <ProductRoadmap />
      <FAQAccordion tag="FAQ" title="Frequently asked questions" items={homeFAQData} />
      {/* <CTABanner /> */}
    </>
  );
}

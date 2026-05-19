import { SampleReportHero } from "@/components/sampleReport/SampleReportHero";
import { ReportPreviewForm } from "@/components/sampleReport/ReportPreviewForm";
import { WhatsInsideReport } from "@/components/sampleReport/WhatsInsideReport";
import { KeyInsights } from "@/components/sampleReport/KeyInsights";
import { WhatMakesDifferent } from "@/components/sampleReport/WhatMakesDifferent";
import { WhoThisReportFor } from "@/components/sampleReport/WhoThisReportFor";
import { FAQAccordion } from "@/components/common/FAQAccordion";

const sampleReportFAQData = [
  {
    question: "What does SearchTrust analyze?",
    answer: "SearchTrust analyzes one submitted local page URL and evaluates it through a six-layer trust model to identify where structural trust breaks down and what to fix first.",
  },
  {
    question: "What kinds of pages is it best for?",
    answer: "SearchTrust is best for local service pages, city pages, service-area pages, and location landing pages. It is built for local page trust diagnosis, not general-purpose site auditing.",
  },
  {
    question: "Is this a full SEO audit?",
    answer: "No. SearchTrust is not a full technical SEO audit, rank tracker, or GBP management tool. It focuses on page-level trust qualification, structural credibility, and local competitiveness.",
  },
  {
    question: "What do I receive after purchase?",
    answer: "You receive one structured report for one submitted URL. The report includes current trust status, dominant failure layer, findings across the six-layer model, and prioritized recommendations.",
  },
  {
    question: "How is the report delivered?",
    answer: "After payment, you submit the URL you want reviewed. Your report is delivered by email within two hours.",
  },
  {
    question: "Is the report automated?",
    answer: "SearchTrust generates the report through an automated analysis workflow based on the submitted page and the SearchTrust framework.",
  },
  {
    question: "Can I use this before publishing a page?",
    answer: "Yes. Pre-publish review is one of the clearest use cases for SearchTrust. It can help identify weak local grounding, template risk, and trust gaps before rollout.",
  },
  {
    question: "Does this guarantee better rankings?",
    answer: "No. SearchTrust does not guarantee rankings, traffic, or business outcomes. It helps diagnose structural trust weaknesses that may affect a page's ability to compete in local search.",
  },
  {
    question: "Is this suitable for agencies?",
    answer: "Yes. Agencies can use SearchTrust for pre-publish reviews, stuck-page diagnosis, and clearer client reporting around page-level trust weaknesses.",
  },
  {
    question: "Can I get a refund?",
    answer: "Refunds may be available before processing begins. Once report processing has started or the report has been delivered, purchases are generally non-refundable. Please see our Refund Policy for full details.",
  },
];
import { ReportCTA } from "@/components/sampleReport/ReportCTA";
import {AuditForm} from "@/components/sampleReport/AuditForm";
import {TrustCollapseModel} from "@/components/sampleReport/TrustCollapseModel";
import {SampleReportInfo} from "@/components/sampleReport/SampleReportInfo";
import {AuditPreview} from "@/components/sampleReport/AuditPreview";
import {TrustLayerDetail} from "@/components/sampleReport/TrustLayerDetail";
import {ReportDifference} from "@/components/sampleReport/ReportDifference";

export const metadata = {
  title: "Sample Report — SearchTrust",
  description:
    "See what a SearchTrust local trust audit looks like. Explore a sample report showing how trust breakdown is diagnosed across six structural layers.",
};

export default function SampleReportPage() {
  return (
    <>
      <SampleReportHero />
      {/* <AuditForm /> */}
      <SampleReportInfo />
      <AuditPreview />
      <WhatsInsideReport />
      <KeyInsights />
      {/* <TrustLayerDetail /> */}
      <ReportDifference />
      {/* <TrustCollapseModel /> */}
      {/* <ReportPreviewForm /> */}
      {/* <WhatMakesDifferent /> */}
      <WhoThisReportFor />
      <FAQAccordion tag="FAQ" title={"Frequently asked\nquestions"} items={sampleReportFAQData} />
      <ReportCTA />
    </>
  );
}

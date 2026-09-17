import { SampleReportHero } from "@/components/sampleReport/SampleReportHero";
import { WhatsInsideReport } from "@/components/sampleReport/WhatsInsideReport";
import { KeyInsights } from "@/components/sampleReport/KeyInsights";
import { WhoThisReportFor } from "@/components/sampleReport/WhoThisReportFor";
import { FAQAccordion } from "@/components/common/FAQAccordion";

const sampleReportFAQData = [
  {
    question: "What does SearchTrust analyze?",
    answer: "A Prospect workflow combines the confirmed business, its public site and at least one real competitor with the SearchTrust L1-L8 evidence model. A Verified workflow adds connected GSC and GA4 performance data after engagement.",
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
    question: "What does one Case include?",
    answer: "A Case keeps the confirmed business, competitors, source evidence and generated report together. Prospect produces an evidence-backed sales report; Verified can later produce an action plan using connected GSC and GA4 data.",
  },
  {
    question: "When is a credit used?",
    answer: "Entering a website and confirming the business is free. One credit is used when provider-backed Prospect discovery starts or when a Verified Action Plan is generated. Technical generation failures return the credit.",
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
    question: "Does this promise higher placement?",
    answer: "No. SearchTrust does not promise rankings, traffic, or business outcomes. It helps diagnose structural trust weaknesses that may affect a page's ability to compete in local search.",
  },
  {
    question: "Is this suitable for agencies?",
    answer: "Yes. Agencies can use the Advisor report as an internal working document, open the focused Client report, and export either view as a PDF.",
  },
  {
    question: "Can I get a refund?",
    answer: "An unspent credit purchase may be refunded through the payment provider. If a purchased credit has already been used, the request needs manual review. Please see our Refund Policy for full details.",
  },
];
import {SampleReportInfo} from "@/components/sampleReport/SampleReportInfo";
import {ReportDifference} from "@/components/sampleReport/ReportDifference";
import { createPageMetadata, pageSeo } from "@/lib/seo";

export const metadata = createPageMetadata(pageSeo.sampleReport);

const sampleReportJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: sampleReportFAQData.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

export default function SampleReportPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(sampleReportJsonLd) }}
      />
      <SampleReportHero />
      <SampleReportInfo />
      <WhatsInsideReport />
      <KeyInsights />
      <ReportDifference />
      <WhoThisReportFor />
      <FAQAccordion tag="FAQ" title={"Frequently asked\nquestions"} items={sampleReportFAQData} />
    </>
  );
}

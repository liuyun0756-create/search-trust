import { SampleReportHero } from "@/components/sampleReport/SampleReportHero";
import { WhatsInsideReport } from "@/components/sampleReport/WhatsInsideReport";
import { KeyInsights } from "@/components/sampleReport/KeyInsights";
import { WhoThisReportFor } from "@/components/sampleReport/WhoThisReportFor";
import { FAQAccordion } from "@/components/common/FAQAccordion";
import { SampleReportContent } from "@/components/report/SampleReportContent";

const sampleReportFAQData = [
  {
    question: "What does SearchTrust analyze?",
    answer: "SearchTrust analyzes one submitted local page URL through an evidence-backed 8-layer trust model to identify where structural trust breaks down and what to fix first.",
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
    answer: "You receive one structured web report for one submitted URL. It includes an overall decision summary, page-level interpretation, confirmed key issues, the complete L1-L8 trust breakdown, traceable evidence, executable actions, a four-phase implementation roadmap, and PDF export.",
  },
  {
    question: "How is the report delivered?",
    answer: "After payment, you submit the URL you want reviewed. The report is generated and saved as a web report after processing. Timing varies with page availability, public data coverage, and workflow load.",
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
    answer: "Yes. Agencies can use the full audit as an internal working document, preview the simplified client report, and export either a client-ready PDF or a full audit PDF.",
  },
  {
    question: "Can I get a refund?",
    answer: "Refunds may be available before processing begins. Once report processing has started or the report has been delivered, purchases are generally non-refundable. Please see our Refund Policy for full details.",
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
      <SampleReportContent embedded />
      <WhatsInsideReport />
      <KeyInsights />
      <ReportDifference />
      <WhoThisReportFor />
      <FAQAccordion tag="FAQ" title={"Frequently asked\nquestions"} items={sampleReportFAQData} />
    </>
  );
}

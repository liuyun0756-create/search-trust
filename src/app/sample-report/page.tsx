import { SampleReportsV22 } from "@/components/sampleReport/SampleReportsV22";
import { FAQAccordion } from "@/components/common/FAQAccordion";

const sampleReportFAQData = [
  {
    question: "What does SearchTrust analyze?",
    answer: "Prospect uses the confirmed business, its public website and business information, and at least one real competitor to develop a proposal. After client access, Verified can add eligible Search Console and GA4 evidence to revisit the same questions and prioritize work. The eight-layer trust model is one part of the wider diagnosis.",
  },
  {
    question: "Why are there two reports for one business?",
    answer: "They serve two consecutive decisions. The Prospect Evidence Report helps an SEO discuss specific work before private analytics access. The Verified Action Plan uses eligible client evidence and confirmation to retain, revise or defer those initial recommendations.",
  },
  {
    question: "Is this a full SEO audit?",
    answer: "No. SearchTrust does not replace a full technical audit, rank tracker, GBP management or an SEO's professional review. It organizes business, page, competition and available performance evidence around decisions and actions for local SEO work.",
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
    answer: "The product generates evidence-based report material, but the SEO remains responsible for checking the reasoning, conditions and proposed work before presenting a professional recommendation to a client.",
  },
  {
    question: "Can I edit the reports on this sample page?",
    answer: "You can test wording and action edits in this isolated website demonstration. They remain in the current page until refresh and do not change a real customer report, saved plan, PDF or share link. Persistent report editing and approval are not yet represented by this demo.",
  },
  {
    question: "Does this promise higher placement?",
    answer: "No. An observed gap or a proposed edit is not proof of causation or a guarantee of rankings, traffic, leads or revenue. The reports preserve what is confirmed, what remains uncertain and how to check the work later.",
  },
  {
    question: "Is this suitable for agencies?",
    answer: "Yes. An SEO can inspect the detailed working view and the clearer client reading view. Both must retain important evidence limits and conditions. The sample-page editor is a demonstration only and does not change the actual workspace report.",
  },
  {
    question: "Can I get a refund?",
    answer: "An unspent credit purchase may be refunded through the payment provider. If a purchased credit has already been used, the request needs manual review. Please see our Refund Policy for full details.",
  },
];
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
      <SampleReportsV22 />
      <FAQAccordion tag="FAQ" title={"Frequently asked\nquestions"} items={sampleReportFAQData} />
    </>
  );
}

import { SampleReportsV22 } from "@/components/sampleReport/SampleReportsV22";
import { sampleFAQs } from "@/components/sampleReport/deliverable-content";
import { createPageMetadata, pageSeo } from "@/lib/seo";

export const metadata = createPageMetadata(pageSeo.sampleReport);
const sampleReportJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: sampleFAQs.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
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
    </>
  );
}

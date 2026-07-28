"use client";

import { ReportContent } from "./ReportContent";
import { SAMPLE_REPORT_V21 } from "./sampleReportV21";

interface SampleReportContentProps {
  embedded?: boolean;
}

export function SampleReportContent({ embedded = false }: SampleReportContentProps) {
  const IntroTitleTag = embedded ? "h2" : "p";

  return (
    <section className="bg-[#F8F9FA] py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-12">
          <IntroTitleTag className="text-[36px] font-bold text-[#1A212B] tracking-tighter mb-3">
            Full Trust Audit Example
          </IntroTitleTag>
          <p className="mx-auto max-w-2xl text-[15px] font-medium leading-relaxed text-[#6B7280]">
            This representative sample shows the evidence-backed report structure for an emergency plumbing service page. It is static sample data, not a fresh crawl.
          </p>
        </div>
        <ReportContent
          report={SAMPLE_REPORT_V21}
          isPaid={true}
          isLoading={false}
          titleLevel={embedded ? "h2" : "h1"}
        />
      </div>
    </section>
  );
}

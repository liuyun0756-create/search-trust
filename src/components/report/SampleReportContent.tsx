"use client";

import { ReportContent } from "./ReportContent";
import { SAMPLE_REPORT_V21 } from "./sampleReportV21";

export function SampleReportContent() {
  return (
    <section className="bg-[#F8F9FA] py-20">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-[36px] font-bold text-[#1A212B] tracking-tighter mb-3">
            Full Trust Audit Example
          </h2>
          <p className="text-[15px] text-[#6B7280] font-medium max-w-lg mx-auto">
            This representative v2.1 sample shows the evidence-backed report structure for an emergency plumbing service page. It is static sample data, not a fresh crawl.
          </p>
        </div>
        <ReportContent
          report={SAMPLE_REPORT_V21}
          isPaid={true}
          isLoading={false}
        />
      </div>
    </section>
  );
}

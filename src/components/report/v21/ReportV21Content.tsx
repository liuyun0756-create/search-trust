"use client";

import type { NormalizedReportV21Result } from "@/lib/report-v21";
import type { ReactNode } from "react";
import { useState } from "react";
import type { Report } from "@/types/database";
import { V21DataCoverage } from "./V21DataCoverage";
import { V21BrandingHeader } from "./V21BrandingHeader";
import { V21GBPAlignment } from "./V21GBPAlignment";
import { V21KeyIssues } from "./V21KeyIssues";
import { V21OptimizationPath } from "./V21OptimizationPath";
import { V21OverallConclusion } from "./V21OverallConclusion";
import { V21PageLevel } from "./V21PageLevel";
import { V21TrustLayers } from "./V21TrustLayers";
import { V21ViewModeToggle } from "./V21ViewModeToggle";
import type { V21ViewMode } from "./viewMode";

export const V21_SECTION_IDS = {
  "Overall Conclusion": "section-overall-conclusion",
  "Page Level": "section-page-level",
  "Key Issues": "section-key-issues",
  "Trust Layer Breakdown": "section-trust-layer-breakdown",
  "Optimization Path": "section-optimization-path",
  "Data Coverage": "section-data-coverage",
  "GBP × Page Alignment": "section-gbp-page-alignment",
} as const;

export type V21TabId = keyof typeof V21_SECTION_IDS;

export const V21_TABS = Object.keys(V21_SECTION_IDS) as V21TabId[];

export function ReportV21Content({
  normalized,
  rawReport: _rawReport,
  isLoading = false,
}: {
  normalized: NormalizedReportV21Result;
  rawReport: Report;
  isLoading?: boolean;
}) {
  const [viewMode, setViewMode] = useState<V21ViewMode>("analyst");
  const report = normalized.reportV21;
  const pageLevel = report.page_level ?? {
    label: "Unknown",
    what_it_looks_like: "No structured page-level explanation was available.",
    strengths: [],
    missing_elements: [],
  };
  const optimizationPath = report.optimization_path ?? {
    must_execute_now: [],
    defer_until_later: [],
    do_not_prioritize_yet: [],
    roadmap: [],
    fix_order_warning: "",
    completion_signals: [],
  };
  const gbpStatus = report.gbp_status ?? {
    status: "not_checked" as const,
    reason: "GBP status was not available in the report payload.",
  };
  const dataCoverage = report.data_coverage ?? {
    page_content_checked: false,
    gbp_checked: false,
    schema_checked: false,
    contact_page_checked: false,
    about_page_checked: false,
    reviews_checked: false,
    internal_pages_checked: false,
    competitor_pages_checked: false,
    limitations: ["Data coverage was not available in the report payload."],
  };

  if (isLoading) {
    return (
      <div className="rounded-[28px] border border-gray-200 bg-white p-10 text-center shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-[#A5D020]/30 border-t-[#A5D020]" />
        <p className="text-[13px] font-black uppercase tracking-[0.14em] text-gray-500">Analyzing report...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <V21ViewModeToggle mode={viewMode} onChange={setViewMode} />
      <V21BrandingHeader reportV21={report} viewMode={viewMode} />

      <Section id={V21_SECTION_IDS["Overall Conclusion"]} title="Overall Conclusion">
        <V21OverallConclusion normalized={normalized} viewMode={viewMode} />
      </Section>

      <Section id={V21_SECTION_IDS["Page Level"]} title="Page Level">
        <V21PageLevel pageLevel={pageLevel} viewMode={viewMode} />
      </Section>

      <Section id={V21_SECTION_IDS["Key Issues"]} title="Key Issues">
        <V21KeyIssues keyIssues={report.key_issues} viewMode={viewMode} />
      </Section>

      <Section id={V21_SECTION_IDS["Trust Layer Breakdown"]} title="Trust Layer Breakdown">
        <V21TrustLayers layers={report.layers} viewMode={viewMode} />
      </Section>

      <Section id={V21_SECTION_IDS["Optimization Path"]} title="Optimization Path">
        <V21OptimizationPath optimizationPath={optimizationPath} viewMode={viewMode} />
      </Section>

      <Section id={V21_SECTION_IDS["Data Coverage"]} title="Data Coverage">
        <V21DataCoverage gbpStatus={gbpStatus} dataCoverage={dataCoverage} source={normalized.source} viewMode={viewMode} />
      </Section>

      <Section id={V21_SECTION_IDS["GBP × Page Alignment"]} title="GBP × Page Alignment">
        <V21GBPAlignment reportV21={report} viewMode={viewMode} />
      </Section>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="relative overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
        <div className="border-b border-gray-100 bg-[#F8FAF5] px-8 py-5 md:px-12">
          <div className="flex items-center gap-3">
            <div className="h-6 w-1.5 rounded-full bg-[#A5D020]" />
            <h2 className="text-[22px] font-black tracking-tight text-[#1A212B]">{title}</h2>
          </div>
        </div>
        <div className="p-6 md:p-10">{children}</div>
      </div>
    </section>
  );
}
